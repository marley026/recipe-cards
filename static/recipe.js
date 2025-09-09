function timeConvert(time) {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = time.match(regex);
    if (!matches) {
        return "Invalid duration format";
    }

    const hours = parseInt(matches[1] || 0, 10);
    const minutes = parseInt(matches[2] || 0, 10);
    const seconds = parseInt(matches[3] || 0, 10);

    let parts = [];

    if (hours > 0) {
        parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} min`);
    }
    if (seconds > 0) {
        parts.push(`${seconds} sec`);
    }

    if (parts.length === 0) {
        return "";
    }

    // Join the parts with appropriate conjunctions
    if (parts.length > 1) {
        return `${parts.join(' ')}`;
    } else {
        return parts[0];
    }
}




document.addEventListener('DOMContentLoaded', function() {
    const recipe = JSON.parse(`${document.getElementById('recipe').innerText}`);

    // Title
    document.title = recipe['name'];
    document.getElementById('title').textContent = recipe['name'];

    // Image
    if (recipe['image']) {
        const image = document.querySelector('.recipe-image');
        if (Array.isArray(recipe['image'])) {
            if (typeof recipe['image'][0] === 'string') {
                image.src = recipe['image'][0];
            } else {
                image.src = recipe['image'][0]['url'];
            }
        } else {
            if (typeof recipe['image'] === "string") {
                image.src = recipe['image']
            } else {
                image.src = recipe['image']['url'];
            }
        }
        image.alt = recipe['name'];

        // Image toggle
        document.getElementById('switch').style = '';

        document.getElementById("image-check").addEventListener("change", () => {
            const image = document.getElementById("image-div");
            if (document.getElementById("image-check").checked == true) {
                image.style.display = 'flex';
            } else {
                image.style.display = 'none';
            }
        });
    }

    // Meta
    if (recipe['description'] || recipe['articleBody'] || recipe['author'] || recipe['recipeYield'] || recipe['totalTime']) {
        const meta = document.createElement('div');
        meta.classList.add('recipe-meta');

        if (recipe['author']) {
            const author = document.createElement('span');
            if (Array.isArray(recipe['author'])) {
                recipe['author'].forEach(x => {
                    if (x['name']) {
                        author.innerHTML = `<strong>Author:</strong> ${x['name']}`;
                    }
                });
            } else {
                if (recipe['author']['name']) {author.innerHTML = `<strong>Author:</strong> ${recipe['author']['name']}`;}
            }
            meta.appendChild(author);
        }
        if (recipe['recipeYield']) {
            const yield = document.createElement('span');
            if (Array.isArray(recipe['recipeYield'])) {
                yield.innerHTML = `<strong>Yield:</strong> ${recipe['recipeYield'].slice(-1)[0]}`;
            } else {
                yield.innerHTML = `<strong>Yield:</strong> ${recipe['recipeYield']}`;
            }
            meta.appendChild(yield);
        }
        if (recipe['totalTime']) {
            const time = document.createElement('span');
            if (recipe['totalTime'] && recipe['prepTime'] || recipe['cookTime']) {
                time.id = ('times');
                time.innerHTML = `
                <strong>Total Time:</strong> ${recipe['totalTime'].startsWith('PT') ? timeConvert(recipe['totalTime']) : recipe['totalTime']}
                <span id="time-dropdown" class="arrow down"></span>`
                const additionalTime = document.createElement('ul');
                additionalTime.classList.add('additional-time');

                if (recipe['prepTime']) {
                    const prep = document.createElement('li');
                    prep.innerHTML = `<strong>Prep Time:</strong> ${recipe['prepTime'].startsWith('PT') ? timeConvert(recipe['prepTime']) : recipe['prepTime']}`;
                    additionalTime.appendChild(prep);
                }
                if (recipe['cookTime']) {
                    const cook = document.createElement('li');
                    cook.innerHTML = `<strong>Cook Time:</strong> ${recipe['cookTime'].startsWith('PT') ? timeConvert(recipe['cookTime']) : recipe['cookTime']}`;
                    additionalTime.appendChild(cook);
                }

                time.appendChild(additionalTime);
            } else {
                time.innerHTML = `<strong>Total Time:</strong> ${recipe['totalTime'].startsWith('PT') ? timeConvert(recipe['totalTime']) : recipe['totalTime']}`;
            }
            meta.appendChild(time);

            time.addEventListener('click', function () {
                const arrow = document.querySelector('#time-dropdown');
                const additionalTimes = document.querySelector('.additional-time');

                if (arrow.classList.contains('down')) {
                    arrow.classList.remove('down');
                    arrow.classList.add('up');
                    additionalTimes.style.maxHeight = additionalTimes.scrollHeight + "px";
                } else {
                    arrow.classList.remove('up');
                    arrow.classList.add('down');
                    additionalTimes.style.maxHeight = '0px';
                }
            });
        }
        if (recipe['description'] || recipe['articleBody']) {
            const desc = document.createElement('p');
            desc.classList.add('recipe-desc');
            if (recipe['description']) {
                desc.innerText = recipe['description'];
            } else {
                desc.innerText = recipe['articleBody'];
            }
            meta.appendChild(desc);
        }

        document.querySelector('.recipe-top').appendChild(meta);
    }

    // Ingredients
    const ingredients = document.getElementById('ingredients');
    recipe['recipeIngredient'].forEach(ingredient => {
        const li = document.createElement('li');
        li.innerText = ingredient;
        ingredients.appendChild(li);
    });

    // Directions
    const directions = document.getElementById('directions');
    var counter = 1;
    recipe['recipeInstructions'].forEach(step => {
        if (step['@type'] == 'HowToSection') { // For each section
            const header = document.createElement('p');
            header.innerText = !step['name'].endsWith(':') ? step['name'] + ':' : step['name'];
            header.classList.add('section-header');
            directions.appendChild(header);

            const section = document.createElement('ol');
            section.start = counter;

            section.setAttribute('name', step['name']);
            section.classList.add('directions-section');

            step['itemListElement'].forEach(s => {
                const li = document.createElement('li');
                li.innerText = s['text'];
                section.appendChild(li);
                counter += 1;
            });
            directions.appendChild(section);
        } else if (step['@type'] == 'HowToStep') {
            const li = document.createElement('li');
            li.innerText = step['text'];
            directions.appendChild(li);
        } else if (typeof step === 'string') { // If just list of directions
            const li = document.createElement('li');
            li.innerText = step;
            directions.appendChild(li);
        } else {directions.innerText = recipe['recipeInstructions'];} // Something else -> just return unformatted JSON
    });


    const source = document.getElementById('source');
    source.href = recipe['url'];
    source.textContent = recipe['publisher']['name'];


    // Print button
    const printButton = document.getElementById("print");
    printButton.addEventListener("click", () => {
        var main = document.querySelector("main");
        main.classList.remove("container");
        window.print();
        main.classList.add("container");
    });

    
    // Scroll fade
    const ingredientsDiv = document.querySelector('.recipe-ingredients');
    if (ingredientsDiv.clientHeight >= window.innerHeight) {
        const scrollFade = document.createElement('div');
        scrollFade.classList.add('scroll-fade');
        ingredientsDiv.appendChild(scrollFade);
    }


    // Delete button
    const deleteButton = document.getElementById("delete-button");
    deleteButton.setAttribute('recipe', recipe['@id']);
    deleteButton.addEventListener('click', () => {
        const recipeRoute = deleteButton.getAttribute('recipe');
        if (confirm("Are you sure you want to delete this recipe?")) {
            fetch("/remove-card", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ recipe_route: recipeRoute })
            })
            .then(response => {
                if (response.ok) {
                    window.location.href = "/cards";
                } else {
                    alert("Failed to delete recipe");
                }
            });
        }
    });
});