import extruct
import html
import json
import os
import re
import requests
import unicodedata
import uuid
from bs4 import BeautifulSoup
from flask import render_template
from google import genai
from google.genai import types
from urllib.parse import urlparse
from w3lib.html import get_base_url


def apology(message, code=400):
    """Render message as an apology to user."""

    def escape(s):
        """
        Escape special characters.

        https://github.com/jacebrowning/memegen#special-characters
        """
        for old, new in [
            ("-", "--"),
            (" ", "-"),
            ("_", "__"),
            ("?", "~q"),
            ("%", "~p"),
            ("#", "~h"),
            ("/", "~s"),
            ('"', "''"),
        ]:
            s = s.replace(old, new)
        return s

    return render_template("apology.html", top=code, bottom=escape(message)), code


def get_image_link(image):
    IMG_API_KEY = os.environ["IMG_API_KEY"]
    UPLOAD_URL = 'https://api.imgbb.com/1/upload'

    # Send POST request to Imgbb API
    response = requests.post(UPLOAD_URL, files={'image': image}, data={'key': IMG_API_KEY})

    if response.status_code == 200:
        # Extract the URL of the uploaded image from the response
        image_url = response.json()['data']['image']['url']
        return image_url
    else:
        print(f"Error: {response.status_code}")
        return None


def separate_content(text, delimiter):
    if delimiter is None:
        return text.splitlines()
    else:
        return text.split(delimiter)


def recipe_route(title):
    title = html.unescape(title.strip())
    title = unicodedata.normalize('NFKD', title)
    title = title.encode('ascii', 'ignore').decode('ascii')
    title = re.sub(r'[^\w\s-]', '', title.lower())
    title = re.sub(r'[-\s]+', '-', title).strip('-')
    return title + '-' + uuid.uuid4().hex[:6]


def sanitize_text(value):
    if not isinstance(value, str):
        return value
    # Unescape HTML (e.g., &amp;)
    value = html.unescape(value)
    # Replace non-breaking spaces with regular spaces
    value = value.replace('\xa0', ' ')
    # Strip leading/trailing whitespace
    return value.strip()

def sanitize_json(obj):
    if isinstance(obj, dict):
        return {k: sanitize_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_json(item) for item in obj]
    elif isinstance(obj, str):
        return sanitize_text(obj)
    else:
        return obj
    

def get_nutrients(ingr):
    NUTRI_ID = os.environ["NUTRI_ID"]
    NUTRI_KEY = os.environ["NUTRI_API_KEY"]

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    rules = '''
You are a food ingredient normalizer.  
Input: A list of recipe ingredients.  
Output: A single plain text string, where each ingredient is on its own line with a clear quantity and unit if provided.

Rules:
- Remove notes in parentheses, HTML entities, alternative measurements, and extra explanations.
- If multiple preparations are described (e.g. "zest and juice of 1 lemon"), create separate ingredient entries.
- Keep only the essential quantity, unit, and name.
- Prefer weight-based measurements. If both weight and volume are given, keep only the weight.
- Keep ingredient names as simple as possible.
- When formatting eggs:
    - Whole eggs: "egg, {quantity} {size}" (e.g., "egg, 2 large")
    - Egg whites: "egg white, {quantity} {size}"
    - Egg yolks: "egg yolk, {quantity} {size}"

Ingredients:
'''

    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        config=types.GenerateContentConfig(
            system_instruction=rules),
        contents=f'{ingr}'
    )
    
    headers = { 
        "x-app-id": NUTRI_ID,
        "x-app-key": NUTRI_KEY,
        "Content-Type": "application/json"
    }

    data = {
        "query": response.text
    }

    response = requests.post("https://trackapi.nutritionix.com/v2/natural/nutrients", headers=headers, json=data)
    if not response.ok:
        return("Error:", response.text)


    nutrient_id = {
        "calories": 208,
        "fatContent": 204,
        "saturatedFatContent": 606,
        "transFatContent": 605,
        "cholesterolContent": 601,
        "sodiumContent": 307,
        "carbohydrateContent": 205,
        "fiberContent": 291,
        "sugarContent": 269,
        "proteinContent": 203,
        "vitaminDContent": 324,
        "calciumContent": 301,
        "ironContent": 303,
        "potassiumContent": 306
    }

    total = {
        "@type": "NutritionInformation",
        "calories": 0,
        "fatContent": 0,
        "saturatedFatContent": 0,
        "transFatContent": 0,
        "cholesterolContent": 0,
        "sodiumContent": 0,
        "carbohydrateContent": 0,
        "fiberContent": 0,
        "sugarContent": 0,
        "proteinContent": 0,
        "vitaminDContent": 0,
        "calciumContent": 0,
        "ironContent": 0,
        "potassiumContent": 0
    }

    result = response.json()
    for ing in result['foods']:
        # Convert nutrients list to dictionary for easier lookup
        ing_nutrients = {n["attr_id"]: n["value"] for n in ing["full_nutrients"]}

        for key in nutrient_id:
            nutrient = ing_nutrients.get(nutrient_id[key])
            if nutrient and nutrient > 0:
                total[key] += nutrient


    # Convert iu to mcg
    total['vitaminDContent'] *= 0.025

    return total


def format_json(json, url, site):
    jsonFields = ["name", "description", "author", "image", "totalTime", "prepTime", "cookTime", "recipeYield", "recipeCategory", "recipeCuisine", "keywords", "aggregateRating", "recipeIngredient", "recipeInstructions", "publisher", "copyrightHolder"]

    final = {}
    for field in jsonFields:
        value = json.get(field)
        if value:
            final[field] = value
    
    final['url'] = url
    if not final.get('publisher'):
        final['publisher'] = {}
        final['publisher']['name'] = site

    if not final.get('image'):
        try:
            image = get_recipe_content(url, 'image')
        except RuntimeError:
            image = None
        if image:
            final['image'] = image

    return sanitize_json(final)


def get_recipe_content(url, fetch_type):
    # Add header to mimic a browser connection
    headers = {"Cache-Control":"max-age=0","Upgrade-Insecure-Requests":"1","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7","Sec-Fetch-Site":"same-origin","Sec-Fetch-Mode":"navigate","Sec-Fetch-User":"?1","Sec-Fetch-Dest":"document","Accept-Encoding":"gzip, deflate","Accept-Language":"en-US,en;q=0.9"}
    # Get website HTML
    try:
        response = requests.get(url, headers=headers)
    except requests.exceptions.MissingSchema:
        raise RuntimeError("[[400]]Invalid URL format (missing http/https)")
    except requests.exceptions.InvalidURL:
        raise RuntimeError("[[400]]Malformed URL")
    except requests.exceptions.ConnectionError:
        raise RuntimeError("[[502]]Could not connect to host")
    except requests.exceptions.Timeout:
        raise RuntimeError("[[504]]Request timed out")
    except requests.exceptions.HTTPError as e:
        raise RuntimeError(f"[[{response.status_code}]]HTTP error: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"[[500]]Unexpected error: {str(e)}")
    
    if response.status_code == 200:
        # Replace relative urls with absolute url
        base_url = get_base_url(response.text, response.url)
        data = extruct.extract(response.text, base_url=base_url)

        if fetch_type == 'recipe':
            # Check for JSON-LD  ---  Should work with most websites schema.org
            for item in data.get('json-ld', []):
                # Get site name
                soup = BeautifulSoup(response.text, "html.parser")
                site_name = soup.find("meta", property="og:site_name")
                if site_name and site_name.get("content"):
                    site = site_name["content"]
                else:
                    parsed_url = urlparse(response.url)
                    site = parsed_url.netloc.replace('www.', '').split('.')[0].capitalize()

                item_type = item.get('@type')
                # Check if recipe  ---  Sometimes wrapped in an @graph
                if "@graph" in item:
                    for sub_item in item["@graph"]:
                        sub_item_type = sub_item.get('@type')
                        if sub_item_type == 'Recipe' or (isinstance(sub_item_type, list) and 'Recipe' in sub_item_type):
                            return format_json(sub_item, url, site)
                elif item_type == 'Recipe' or (isinstance(item_type, list) and 'Recipe' in item_type):
                    return format_json(item, url, site)
        """ else:
            for item in data.get('json-ld', []):
                image = item.get('image')
                if image:
                    return image
            raise RuntimeError("No Image") """
    else:
        raise RuntimeError(f"Connection unsuccessful: {response.status_code}")
    raise RuntimeError("No recipe found")