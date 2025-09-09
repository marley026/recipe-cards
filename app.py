import datetime
import json
import os
import psycopg2
import pytz
import re
import uuid
from flask import Flask, flash, redirect, render_template, request, g, make_response, send_file
from functools import wraps
import geoip2.database
from psycopg2.extras import DictCursor
from user_agents import parse
from werkzeug.security import check_password_hash, generate_password_hash

from helpers import apology, recipe_route, get_image_link, separate_content, get_recipe_content


# Configure application
app = Flask(__name__)

# Set session cookies secret key
app.config['SECRET_KEY'] = os.environ["SECRET_FLASK_KEY"]

# Set up database
## https://flask.palletsprojects.com/en/3.0.x/patterns/sqlite3/

DATABASE_URL = os.environ["DATABASE_URL"]

# Get a database connection
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
    return db

# Close database connection
@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# Function to execute queries
def query_db(query, args=(), fetch=True):
    db = get_db()
    cur = db.cursor()
    cur.execute(query, args)
    if fetch:
        rv = cur.fetchall()
        cur.close()
        rv = process_rows(rv)  # Process the rows if any
        return rv
    else:
        db.commit()
        cur.close()
        return None

# Function to convert rows to dictionaries and modify them
def process_rows(rows):
    processed_rows = []
    for row in rows:
        row_dict = dict(row)  # Convert sqlite3.Row to dictionary
        processed_rows.append(row_dict)
    return processed_rows

@app.after_request
def after_request(response):
    """Ensure responses aren't cached"""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response



# IP geolocation
ip_reader = geoip2.database.Reader('./static/GeoLite2-City.mmdb')
def get_ip_location(ip):
    try:
        response = ip_reader.city(ip)
        return {
            "country": response.country.iso_code,
            "region": response.subdivisions.most_specific.name,
            "city": response.city.name
        }
    except Exception:
        return None
    

# Get base user agent info (no version numbers)
def get_ua_info(ua_string):
    ua = parse(ua_string)

    return {
        "browser": ua.browser.family,
        "os": ua.os.family,
        "device": ua.device.family
    }
    

def login_required(f):
    """Decorate routes to require login"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_id = request.cookies.get('session_id')
        if not session_id:
            return redirect("/login")
        
        user_id = get_user_id()

        # Get session
        session =  query_db("SELECT * FROM sessions WHERE session_id = %s", (session_id,), fetch=True)

        # Check if session exists and is valid
        if not session or session[0]['time'] < datetime.datetime.now(pytz.utc) - datetime.timedelta(days=7):
            # Invalidate the session and delete the cookie
            if session:
                query_db("DELETE FROM sessions WHERE session_id = %s", (session_id,), fetch=False)

            response = make_response(redirect('/login'))
            response.delete_cookie('session_id', httponly=True, secure=True, samesite='Lax')
            return response
            
        # Check if user exists
        user_exists = query_db("SELECT * FROM users WHERE id = %s", (user_id,), fetch=True)
        if not user_exists:
            query_db("DELETE FROM sessions WHERE user_id = %s", (user_id,), fetch=False)
            response = make_response(redirect('/login'))
            response.delete_cookie('session_id', httponly=True, secure=True, samesite='Lax')
            return response
        
        # Check for consistent user agent and location
        user_ip = request.remote_addr or "0.0.0.0"
        if session[0]['ip'] != user_ip:
            logged_location = get_ip_location(session[0]['ip'])
            current_location = get_ip_location(user_ip)
            if logged_location['country'] != current_location['country'] or logged_location['region'] != current_location['region']:
                query_db("DELETE FROM sessions WHERE session_id = %s", (session_id,), fetch=False)
                response = make_response(redirect('/login'))
                response.delete_cookie('session_id', httponly=True, secure=True, samesite='Lax')
                return response
            
        user_agent = request.headers.get("User-Agent", "Unknown")
        if user_agent != session[0]['user_agent']:
            old_ua = get_ua_info(session[0]['user_agent'])
            new_ua = get_ua_info(user_agent)
            if old_ua != new_ua:
                query_db("INSERT INTO errors (url, user_id) VALUES (%s, %s)", (f"old:{old_ua}   new:{new_ua}", user_id), fetch=False)
                query_db("DELETE FROM sessions WHERE session_id = %s", (session_id,), fetch=False)
                response = make_response(redirect('/login'))
                response.delete_cookie('session_id', httponly=True, secure=True, samesite='Lax')
                return response
        
        # Extend session
        current_time = datetime.datetime.now(pytz.utc)
        query_db("UPDATE sessions SET time = %s WHERE session_id = %s", (current_time, session_id), fetch=False)

        # Delete any other sessions
        query_db("DELETE FROM sessions WHERE user_id = %s AND session_id != %s", (user_id, session_id), fetch=False)


        return f(*args, **kwargs)
    return decorated_function


def get_user_id():
    user_id = query_db("SELECT user_id FROM sessions WHERE session_id = %s", (request.cookies.get('session_id'),), fetch=True)

    if user_id:
        return user_id[0]['user_id']
    else:
        return None


@app.route('/favicon.ico')
def favicon():
    return send_file('favicon.ico')


@app.route("/")
@login_required
def index():
    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    """Log user in"""

    # User reached route via POST
    if request.method == "POST":
        # Ensure username was submitted
        username = request.form.get("username")
        if not username:
            return apology("must provide username", 400)

        # Ensure password was submitted
        elif not request.form.get("password"):
            return apology("must provide password", 400)

        username = username.upper()
        # Query database for username
        rows = query_db("SELECT * FROM users WHERE username = %s", (username,), fetch=True)

        # Ensure username exists and password is correct
        if len(rows) != 1:
            return apology("user not found", 400)
        elif not check_password_hash(rows[0]["hash"], request.form.get("password")):
            return apology("invalid password", 400)
        
        #IP and User Agent
        user_ip = request.remote_addr or "0.0.0.0"
        user_agent = request.headers.get("User-Agent", "Unknown")
        
        # Set session
        session_id = str(uuid.uuid4())
        query_db("INSERT INTO sessions (session_id, user_id, ip, user_agent, time) VALUES (%s, %s, %s, %s, %s)", (session_id, rows[0]['id'], user_ip, user_agent, datetime.datetime.now(pytz.utc)), fetch=False)
        
        # Set session cookie and redirect home
        response = make_response(redirect('/cards'))
        response.set_cookie('session_id', session_id, max_age=2628000, httponly=True, secure=True, samesite='Lax')
        return response

    # User reached route via GET
    else:
        return render_template("login.html")


@app.route("/logout")
def logout():
    # Delete session
    query_db("DELETE FROM sessions WHERE user_id = %s", (get_user_id(),), fetch=False)

    response = make_response(redirect('/'))
    response.delete_cookie('session_id', httponly=True, secure=True, samesite='Lax')
    return response


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        # Ensure username was submitted
        username = request.form.get("username")
        if not username:
            return apology("must provide username", 400)
        username = username.upper()

        # Ensure passwords was submitted
        password = request.form.get("password")
        if not password:
            return apology("must provide password", 400)
        elif not request.form.get("confirmation"):
            return apology("must confirm password", 400)

        # Ensure password and confirmation match
        if password != request.form.get("confirmation"):
            return apology("passwords must match", 400)

        # Check if unsername is taken
        check_username = query_db("SELECT * FROM users WHERE username = %s", (username,), fetch=True)
        if check_username:
            return apology("username already taken", 400)

        # Log username and password
        query_db("INSERT INTO users (username, hash) VALUES (%s, %s)", (username, generate_password_hash(password)), fetch=False)

        # IP and User Agent
        user_ip = request.remote_addr or "0.0.0.0"
        user_agent = request.headers.get("User-Agent", "Unknown")

        # Set session
        user_id = query_db("SELECT id FROM users WHERE username = %s", (username,), fetch=True)[0]['id']
        session_id = str(uuid.uuid4())
        query_db("INSERT INTO sessions (session_id, user_id, ip, user_agent, time) VALUES (%s, %s, %s, %s, %s)", (session_id, user_id, user_ip, user_agent, datetime.datetime.now(pytz.utc)), fetch=False)
        
        # Set session cookie and redirect home
        response = make_response(redirect('/'))
        response.set_cookie('session_id', session_id, max_age=2628000, httponly=True, secure=True, samesite='Lax')
        return response

    # User reached route via GET
    else:
        return render_template("register.html")


@app.route("/settings", methods=["GET"])
@login_required
def settings():
    return render_template("settings.html")


@app.route("/update_password", methods=["POST"])
@login_required
def update_password():
    # Ensure passwords was submitted
    old = request.form.get("password")
    if not old:
        return apology("must provide old password", 400)
    password = request.form.get("new_password")
    if not password:
        return apology("must provide new password", 400)
    elif not request.form.get("confirmation"):
        return apology("must confirm password", 400)

    # Check password
    id = get_user_id()
    hash = query_db("SELECT hash FROM users WHERE id = %s", (id,), fetch=True)
    if not check_password_hash(hash[0]["hash"], old):
        return apology("invalid password", 400)

    # Ensure password and confirmation match
    if password != request.form.get("confirmation"):
        return apology("passwords must match", 400)

    # Update password
    query_db("UPDATE users SET hash = %s WHERE id = %s", (generate_password_hash(password), id), fetch=False)

    flash("Password Updated!")

    return redirect("/settings")


@app.route("/update_username", methods=["POST"])
@login_required
def update_username():
    # Ensure inputs added
    password = request.form.get("password")
    if not password:
        return apology("must provide password", 400)
    username = request.form.get("new_username")
    if not username:
        return apology("must provide new username", 400)
    username = username.upper()

    # Check password
    id = get_user_id()
    hash = query_db("SELECT hash FROM users WHERE id = %s", (id,), fetch=True)
    if not check_password_hash(hash[0]["hash"], password):
        return apology("invalid password", 400)

    # Check if username taken
    check_user = query_db("SELECT * FROM users WHERE username = %s", (username,), fetch=True)
    if len(check_user) != 0:
        return apology("username taken", 400)

    # Update username
    query_db("UPDATE users SET username = %s WHERE id = %s", (username, id), fetch=False)

    flash("Username Updated!")
    return redirect("/settings")


@app.route("/delete_account", methods=["POST"])
def delete_account():
    # Get id and password
    id = get_user_id()
    password = request.json.get('password')

    # Check password
    hash = query_db("SELECT hash FROM users WHERE id = %s", (id,), fetch=True)
    if not check_password_hash(hash[0]["hash"], password):
        return 'Unauthorized', 401

    # Forget user data
    query_db("DELETE FROM users WHERE id = %s", (id,), fetch=False)
    query_db("DELETE FROM recipes WHERE user_id = %s", (id,), fetch=False)
    query_db("DELETE FROM sessions WHERE user_id = %s", (get_user_id(),), fetch=False)

    # Clear cookies and redirect home
    response = make_response(redirect('/'))
    response.delete_cookie('session_id', httponly=True, secure=True, samesite='Lax')
    return response


@app.route("/cards", methods=["GET"])
@login_required
def cards():
    data = query_db("SELECT contents FROM recipes WHERE user_id = %s", (get_user_id(),), fetch=True)
    recipes = []
    for recipe in data:
        recipes.append(recipe['contents'])

    if len(recipes) < 1:
        return render_template("cards.html", data=False)
    return render_template("cards.html", recipes=json.dumps(recipes), data=True)


@app.route("/add-card", methods=["GET", "Post"])
@login_required
def add_card():
    if request.method == "POST":
        # Get recipe title
        title = request.form.get("title")
        if not title:
            return apology("must add a title", 400)
        # Get ingredients
        ingredients = request.form.get("ingredients")
        if not ingredients:
            return apology("must add ingredients", 400)
        # Get directions
        directions = request.form.get("directions")
        if not directions:
            return apology("must add directions", 400)
        # Get the ingrdients delimiter
        iDelimiter = request.form.get("iDelimiter")
        # If none set to none
        if not iDelimiter:
            iDelimiter = None
        # Get the directions delimiter
        dDelimiter = request.form.get("dDelimiter")
        # If none set to none
        if not dDelimiter:
            dDelimiter = None
        # Get recipe link
        link = request.form.get("link")
        if not link:
            link = None

        # Get image link
        image_link = request.form.get("image_link")
        # If no image link, set to no input
        if not image_link:
            image_link = None

        # Get image if exists and image link not added
        if image_link is None:
            file = request.files['image_upload']
            if file.filename != '':
                # Get link of image get_image_link
                image_link = get_image_link(file.read())
                if image_link == None:
                    return apology("failed to upload image", 500)

        # Add ingredients and directions to one JSON
        contents = {"ingredients": separate_content(
            ingredients, iDelimiter), "directions": separate_content(directions, dDelimiter)}
        contents = json.dumps(contents)

        # Create recipe route
        user = query_db("SELECT username FROM users where id = %s", (get_user_id(),), fetch=True)
        user = user[0]['username']

        if link is None:
            route = user + '-' + title.replace(' ', '-').lower()
        else:
            route = recipe_route(link)
            if route is None:
                route = user + '-' + title.replace(' ', '-').lower()
            else:
                route = user + '-' + route

        # Check if already taken
        i = query_db("SELECT * FROM recipes WHERE route = %s", (route,), fetch=True)
        loop = 0
        while len(i) != 0 and i[0]['route'] == route:
            if loop > 0:
                route = route[:-2]

            route = route + '-' + str(loop)
            i = query_db("SELECT * FROM recipes WHERE route = %s", (route,), fetch=True)

            loop += 1

        # Add to database
        query_db("INSERT INTO recipes (user_id, title, contents, url, image, route) VALUES (%s, %s, %s, %s, %s, %s)", (get_user_id(), title, contents, link, image_link, route), fetch=False)
        return redirect('/recipe/' + route)
    else:
        return render_template("add-card.html")


@app.route('/recipe/<recipe_route>')
@login_required
def show_recipe(recipe_route):
    # Find recipe
    recipe_data = query_db("SELECT * FROM recipes WHERE route = %s", (recipe_route,), fetch=True)

    if recipe_data is None:
        return apology("recipe not found", 404)

    return render_template("recipe.html", recipeJSON=json.dumps(recipe_data[0]['contents']))


@app.route('/recipe/share/<recipe_route>')
def share_recipe(recipe_route):
    return apology("recipe not found", 404)


@app.route("/remove-card", methods=["POST"])
def remove_card():
    recipe_route = request.json.get('recipe_route')

    query_db("DELETE FROM recipes WHERE route = %s", (recipe_route,), fetch=False)

    return redirect("/cards")


@app.route("/add-card-by-url", methods=["POST", "GET"])
@login_required
def add_card_by_url():
    if request.method == "POST":
        # Get url
        url = request.form.get("url")
        if not url:
            return apology("must add a url", 400)

        # Get recipe content
        try:
            recipe = get_recipe_content(url, 'recipe')
        except RuntimeError as e:
            if e == 'No recipe found':
                query_db("INSERT INTO errors (url, user_id) VALUES (%s, %s)", (url, get_user_id()), fetch=False)
                flash("Sorry, we couldn't find a recipe there, we'll look into it")
                return apology("no recipe found", 400)
            elif re.search(r"\[\[\d\d\d\]\]", str(e)):
                error = str(e)
                return apology(error[7:], int(error[2:5]))
            else:
                return apology(e, 500)

        # Create recipe route
        route = recipe_route(recipe['name'])
        # Check if already taken
        i = query_db("SELECT * FROM recipes WHERE route = %s", (route,), fetch=True)
        while len(i) != 0 and i[0]['route'] == route:
            route = recipe_route(recipe['name'])
            i = query_db("SELECT * FROM recipes WHERE route = %s", (route,), fetch=True)

        recipe["@id"] = route

        query_db(
            "INSERT INTO recipes (user_id, title, contents, url, route) VALUES (%s, %s, %s, %s, %s)",
            (get_user_id(), recipe['name'], json.dumps(recipe), url, route), fetch=False
        )

        return redirect("/recipe/" + route)
    else:
        return render_template("add-card-by-url.html")


@app.route("/update-recipe", methods=["POST"])
def update_recipe():
    contents = request.json.get('contents')
    if contents is None:
        return apology("no contents found", 400)
    contents = str(contents).replace("'", '"').replace('\n', '').replace('\r', '').replace('\t', '').replace('\\', '').strip()
    route = request.json.get('recipe_route')
    if route is None:
        return apology("error updating recipe", 500)
    title = request.json.get('title')
    if title is None:
        return apology("no title found", 400)

    query_db("UPDATE recipes SET title = %s, contents = %s WHERE route = %s", (title, contents, route), fetch=False)

    return redirect("/recipe/" + route)


@app.route("/refresh-sessions", methods=["POST"])
def refresh_sessions():
    sessions = query_db("SELECT * FROM sessions")

    current_time = datetime.datetime.now(pytz.utc) - datetime.timedelta(days=7)
    if sessions:
        for session in sessions:
            if session["time"] < current_time:
                query_db("DELETE FROM sessions WHERE session_id = %s", (session["session_id"],), fetch=False)

    return redirect("/")


@app.route("/remove-user", methods=["POST"])
def remove_user():
    user_id = request.json.get('user_id')

    query_db("DELETE FROM users WHERE id = %s", (user_id,), fetch=False)
    query_db("DELETE FROM recipes WHERE user_id = %s", (user_id,), fetch=False)
    query_db("DELETE FROM sessions WHERE user_id = %s", (user_id,), fetch=False)

    return redirect("/")


if __name__ == '__main__':
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
