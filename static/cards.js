function makeCard(recipe) {
  const container = document.getElementById('card-container');
    const card = document.createElement('div');
    card.setAttribute('class', 'col-12 col-md-6 col-lg-4 col-xl-3');

    // Image
    let img = '';
    if (recipe['image']) {
        if (Array.isArray(recipe['image'])) {
            if (typeof recipe['image'][0] === 'string') {
                img = recipe['image'][0];
            } else {
                img = recipe['image'][0]['url'];
            }
        } else {
            if (typeof recipe['image'] === "string") {
                img = recipe['image']
            } else {
                img = recipe['image']['url'];
            }
        }
    }

    // Card body
    card.innerHTML = `
    <div class="card card-custom">
        <img src="${img}" class="card-img-top" alt="${recipe['name']}">
        <div class="card-body">
            <h5 class="card-title">${recipe['name']}</h5>
            <p class="card-text">Source: <a class="source-link" href="${recipe['url']}">${recipe['publisher']['name']}</a></p>
            <form onsubmit="remove_card(event)">
                <input type="hidden" name="recipe_route" value="${recipe['@id']}">
                <button type="submit" class="btn delete-button card-btn">Delete</button>
            </form>
            <a href="/recipe/${recipe['@id']}" class="stretched-link"></a>
        </div>
    </div>`

    container.appendChild(card);
}


function renderCards(cards, search = '') {
  const container = document.getElementById('card-container');
    container.innerHTML = '';
    if (cards.length < 1) {
        container.innerHTML = `<span style="margin: auto; margin-top: 10px;">No cards found for "${search}"</span>`;
        container.setAttribute('style', '');
    } else {
        cards.forEach(card => {
            makeCard(card);
        });

        initializeMasonry();
    }
}


// Masonry
function initializeMasonry() {
  const container = document.querySelector('#card-container');

  if (!container) return;

  // Destroy any existing Masonry instance
  if (container.masonryInstance) {
    container.masonryInstance.destroy();
  }

  imagesLoaded(container, function () {
    container.masonryInstance = new Masonry(container, {
      itemSelector: '.col-12',
      percentPosition: true
    });
  });
}


// Delete Recipe
function remove_card(event) {
  event.preventDefault();

  if (confirm("Are you sure you want to delete recipe?")) {
      route = event.currentTarget.querySelector('[name="recipe_route"]').value;

      fetch("/remove-card", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ recipe_route: route })
      })
      .then(response => {
          if (response.ok) {
              window.location.href = "/cards";
          } else {
              alert("Failed to delete recipe");
          }
      });
  }
}



// Initial load
document.addEventListener('DOMContentLoaded', function() {
  const recipes = JSON.parse(`${document.getElementById('data').innerText}`);
  renderCards(recipes);

  // Search
  const options = {
    keys: [
      "name",
      "description",
      "recipeIngredient",
      "keywords",
      "recipeCuisine",
      "recipeCategory",
      "author.name",
      "publisher.name"
    ],
    threshold: 0.4
  };
  const fuse = new Fuse(recipes, options);


  const searchInput = document.getElementById('search-bar');
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query === '') {
      renderCards(recipes);
    } else {
      const results = fuse.search(query);
      renderCards(results.map(result => result.item), query);
    }
  });
});