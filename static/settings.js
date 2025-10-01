document.addEventListener('DOMContentLoaded', function() {
    const darkToggle = document.querySelector('.theme-toggle input');

    document.querySelector('.theme-toggle').addEventListener('click', () => {
        if (darkToggle.checked == false) {
            document.body.classList.add('darkmode');
            localStorage.setItem('themePreference', 'dark');
        } else {
            document.body.classList.remove('darkmode');
            localStorage.setItem('themePreference', 'light');
        }
    });


    document.querySelector('#current-button').addEventListener('click', () => {
        window.location.replace('/logout');
    });

    document.querySelector('.account').addEventListener('click', (e) => {
        const formContainer = document.querySelector('.form-container-div');
        if (e.target.id == 'username') {
            formContainer.innerHTML = `
            <div class="form-container">
            <h1>Change Username</h1>
            <form action="/update_username" method="post">
                <div class="mb-3">
                    <input class="form-control mx-auto w-auto" name="password" placeholder="Password" type="password">
                </div>
                <div class="mb-3">
                    <input autocomplete="off" class="form-control mx-auto w-auto" name="new_username" placeholder="New Username" type="text">
                </div>
                <button class="btn button-css" type="submit">Update Username</button>
            </form></div>`;
            showForm('username');
        } else if (e.target.id == 'password') {
            formContainer.innerHTML = `
            <div class="form-container">
            <h1>Change Password</h1>
            <form action="/update_password" method="post">
                <div class="mb-3">
                    <input class="form-control mx-auto w-auto" name="password" placeholder="Old Password" type="password">
                </div>
                <div class="mb-3">
                    <input class="form-control mx-auto w-auto" name="new_password" placeholder="New Password" type="password">
                </div>
                <div class="mb-3">
                    <input class="form-control mx-auto w-auto" name="confirmation" placeholder="Confirm Password" type="password">
                </div>
                <button class="btn button-css" type="submit">Update Password</button>
            </form></div>`;
            showForm('password');
        } else if (e.target.id == 'email') {
            formContainer.innerHTML = `
            <div class="form-container">
            <h1>Update Email</h1>
            <form action="/update_email" method="post">
                <div class="mb-3">
                    <input autocomplete="off" class="form-control mx-auto w-auto" name="email" placeholder="Email" type="text">
                </div>
                <div class="mb-3">
                    <input class="form-control mx-auto w-auto" name="password" placeholder="Password" type="password">
                </div>
                <button class="btn button-css" type="submit">Update Email</button>
            </form></div>`;
            showForm('email');
        }
    });


    document.querySelector('.data').addEventListener('click', (e) => {
        const popupBG = document.querySelector('#popup-bg');
        if (e.target.id == 'export') {
            downloadRecipes('JSON');
            /* popupBG.classList.remove('hidden');
            document.querySelector('#popup-content').innerHTML = `
            <p>How do you want it?</p>
            <button id="recipes-json" class="btn button-css">JSON</button>
             or 
            <button id="recipes-pdf" class="btn button-css">PDF</button>`;
            popupBG.addEventListener('click', (e) => {
                if (e.target.id == "recipes-json") {
                    downloadRecipes('JSON');
                } else if (e.target.id == "recipes-csv") {
                    downloadRecipes('PDF-ZIP', 'ALL');
                }
            }); */
        } else if (e.target.id == 'del-rec') {
            popupBG.classList.remove('hidden');
            document.querySelector('#popup-content').innerHTML = `Are you sure you want to delete ALL your recipes? This can't be undone!<br><br>
            If you're sure, please type "Delete all my recipes" and enter your password below:<br>
            <p id="verify-message">To verify, type "Delete all my recipes" exactly as it appears:</p>
            <form id="delete-all-recipes">
                <div class="mb-3">
                    <input id="confirmation" autocomplete="off" class="form-control mx-auto w-auto" name="confirmation" placeholder="Delete all my recipes" type="text">
                </div>
                <div class="mb-3">
                    <input class="form-control mx-auto w-auto" name="password" placeholder="Password" type="password">
                </div>
                <button class="btn delete-button" type="submit">DELETE ALL MY RECIPES</button>
            </form>`;
        }
    });

    document.getElementById('delete-account-btn').addEventListener('click', () => {
        document.querySelector('#popup-bg').classList.remove('hidden');
        document.querySelector('#popup-content').innerHTML = `Are you sure you want to DELETE your account? This CANNOT be undone!<br>
        Your account can't be recovered, and ALL your recipes will be lost!<br><br>
        If you're sure, please type "Delete my account" and enter your password below:<br>
        <p id="verify-message">To verify, type "Delete my account" exactly as it appears:</p>
        <form id="delete-account">
            <div class="mb-3">
                <input id="confirmation" autocomplete="off" class="form-control mx-auto w-auto" name="confirmation" placeholder="Delete my account" type="text">
            </div>
            <div class="mb-3">
                <input class="form-control mx-auto w-auto" name="password" placeholder="Password" type="password">
            </div>
            <button class="btn delete-button" type="submit">DELETE MY ACCOUNT</button>
        </form>`;
    });

    document.querySelector('.popup-x').addEventListener('click', () => {
        document.querySelector('#popup-bg').classList.add('hidden');
    });
    document.getElementById('popup-bg').addEventListener('click', (e) => {
        if (e.target.id == 'popup-bg') {
            document.querySelector('#popup-bg').classList.add('hidden');
        }
    });

    document.getElementById('np-exit').addEventListener('click', () => {
        document.querySelector('#next-page').classList.add('hidden');
        document.body.classList.remove('no-scroll');
        history.back();
    });

    document.querySelector("#popup-content").addEventListener("submit", (e) => {
        e.preventDefault();
        const confirmation = document.querySelector('#confirmation')
        confirmation.classList.remove('error')
        document.getElementById('verify-message').style.maxHeight = '0px';

        const form = e.target;
        const data = new FormData(form);

        if (e.target.id == 'delete-all-recipes') {
            document.querySelector("#delete-all-recipes input[name='password']").classList.remove('error');
            
            if (data.get('confirmation') != 'Delete all my recipes') {
                void confirmation.offsetWidth;
                confirmation.classList.add('error');
                document.getElementById('verify-message').style.maxHeight = '100px';
            } else {
                delAllRec(data.get('password'));
            }
        } else {
            document.querySelector("#delete-account input[name='password']").classList.remove('error');

            if (data.get('confirmation') != 'Delete my account') {
                void confirmation.offsetWidth;
                confirmation.classList.add('error');
                document.getElementById('verify-message').style.maxHeight = '100px';
            } else {
                deleteAccount(data.get('password'));
            }
        }
        
    });

    document.querySelector('.form-container-div').addEventListener("submit", (e) => {
        e.preventDefault();

        const inputs = document.querySelectorAll("#next-page input");
        inputs.forEach((input) => {
            input.classList.remove('error');
            input.parentElement.classList.remove('empty');
        });

        const form = e.target;
        const data = new FormData(form);

        if (form.action.includes('username')) {
            if (data.get('password') != '' && data.get('new_username') != '') {
                updateUser(data.get('password'), data.get('new_username'));
            } else {
                if (data.get('password') == '') {
                    const passInput = document.querySelector("#next-page input[name='password']");
                    passInput.parentElement.classList.add('empty');
                    passInput.addEventListener("input", () => {
                        if (passInput.value.trim()) {
                            passInput.parentElement.classList.remove("empty");
                        }
                    }, { once: true });
                }
                if (data.get('new_username') == '') {
                    const userInput = document.querySelector("#next-page input[name='new_username']");
                    userInput.parentElement.classList.add('empty');
                    userInput.addEventListener("input", () => {
                        if (userInput.value.trim()) {
                            userInput.parentElement.classList.remove("empty");
                        }
                    }, { once: true });
                }
            }
        } else if (form.action.includes('password')) {
            const old = data.get('password');
            const newPass = data.get('new_password');
            const conf = data.get('confirmation');
            if (old == '' || newPass == '' || conf == '') {
                inputs.forEach((input) => {
                    if (input.value == '') {
                        input.parentElement.classList.add('empty');
                        input.addEventListener("input", () => {
                            if (input.value.trim()) {
                                input.parentElement.classList.remove("empty");
                            }
                        }, { once: true });
                    }
                });
            } else {
                if (newPass != conf) {
                    const message = document.querySelector('#message');
                    message.innerHTML = 'Passwords do not match';
                    message.classList = 'alert alert-danger';
                    setTimeout(() => {
                        message.classList.add('hidden');
                    }, 10000);
                    document.querySelector("#next-page input[name='new_password']").classList.add('error');
                    document.querySelector("#next-page input[name='confirmation']").classList.add('error');
                } else {
                    updatePass(old, newPass);
                }
            }
        } else if (form.action.includes('email')) {
            // update email
        }
    });

    document.querySelector('.sessions').addEventListener('click', (e) => {
        if (e.target.tagName == 'BUTTON') {
            const id = e.target.id;
            if (id == 'logOutAll') {
                logOut('ALL');
            } else if (id != 'current-button') {
                logOut(id);
            }
        }
    });

    document.getElementById('recipe-sort').addEventListener("change", () => {
        updateSettings();
    });
    document.getElementById('image-check').addEventListener("change", () => {
        updateSettings();
    });
});

function showForm(type) {
    document.querySelector('#next-page').classList.remove('hidden');
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('no-scroll');

    history.pushState({ form: type }, "", "?update=" + type);
}

window.addEventListener("popstate", (event) => {
    const hiddenPage = document.querySelector('#next-page');
  if (event.state && event.state.form) {
    // Render Form

    hiddenPage.classList.remove('hidden');
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('no-scroll');
  } else {
    // Default Settings
    
    hiddenPage.classList.add('hidden');
    document.body.classList.remove('no-scroll');
  }
});

async function delAllRec(pass) {
    const message = document.querySelector('#message');
    try {
        const response = await fetch('/delete-all-recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'password': pass})
        });
        const result = await response.json();

        if (result) {
            if (result['error'] != 'None') {
                if (result['error'] == 'invalid password') {
                    document.querySelector("#delete-all-recipes input[name='password']").classList.add('error');
                } else {
                    message.innerHTML = 'Error deleting recipes';
                    message.classList = 'alert alert-danger';
                    setTimeout(() => {
                        message.classList.add('hidden');
                    }, 10000);
                }
            } else {
                message.innerHTML = 'Successfully deleted recipes!';
                message.classList = 'alert alert-success';
                document.querySelector('#popup-bg').classList.add('hidden');
                setTimeout(() => {
                    message.classList.add('hidden');
                }, 10000);
            }
        }
    } catch (error) {
        console.error('Error deleting recipes:', error);
        message.innerHTML = 'Error deleting recipes';
        message.classList = 'alert alert-danger';
        setTimeout(() => {
            message.classList.add('hidden');
        }, 10000);
    }
}

async function updateUser(password, username) {
    const message = document.querySelector('#message');
    try {
        const response = await fetch('/update_username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'password': password, 'username': username})
        });
        const result = await response.json();

        if (result) {
            if (result['error'] != 'None') {
                if (result['error'] == 'invalid password') {
                    document.querySelector("#next-page input[name='password']").classList.add('error');
                } else if (result['error'] == 'username taken') {
                    document.querySelector("#next-page input[name='new_username']").classList.add('error');
                    message.innerHTML = 'Username already taken';
                    message.classList = 'alert alert-warning';
                    setTimeout(() => {
                        message.classList.add('hidden');
                    }, 10000);
                } else {
                    message.innerHTML = 'Error updating username';
                    message.classList = 'alert alert-danger';
                    setTimeout(() => {
                        message.classList.add('hidden');
                    }, 10000);
                }
            } else {
                message.innerHTML = 'Successfully updated username!';
                message.classList = 'alert alert-success';
                document.querySelector('#next-page').classList.add('hidden');
                document.body.classList.remove('no-scroll');
                history.back();
                setTimeout(() => {
                    message.classList.add('hidden');
                }, 10000);
            }
        }
    } catch (error) {
        console.error('Error updating username:', error);
        message.innerHTML = 'Error updating username';
        message.classList = 'alert alert-danger';
        setTimeout(() => {
            message.classList.add('hidden');
        }, 10000);
    }
}

async function updatePass(oldPass, newPass) {
    const message = document.querySelector('#message');
    try {
        const response = await fetch('/update_password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'password': oldPass, 'new_password': newPass})
        });
        const result = await response.json();

        if (result) {
            if (result['error'] != 'None') {
                if (result['error'] == 'invalid password') {
                    document.querySelector("#next-page input[name='password']").classList.add('error');
                } else {
                    message.innerHTML = 'Error updating password';
                    message.classList = 'alert alert-danger';
                    setTimeout(() => {
                        message.classList.add('hidden');
                    }, 10000);
                }
            } else {
                message.innerHTML = 'Successfully updated password!';
                message.classList = 'alert alert-success';
                document.querySelector('#next-page').classList.add('hidden');
                document.body.classList.remove('no-scroll');
                history.back();
                setTimeout(() => {
                    message.classList.add('hidden');
                }, 10000);
            }
        }
    } catch (error) {
        console.error('Error updating password:', error);
        message.innerHTML = 'Error updating password';
        message.classList = 'alert alert-danger';
        setTimeout(() => {
            message.classList.add('hidden');
        }, 10000);
    }
}

async function logOut(session) {
    const message = document.querySelector('#message');
    try {
        const response = await fetch('/log_out_post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'id': session})
        });
        const result = await response.json();

        if (result) {
            if (result['error'] != 'None') {
                    message.innerHTML = 'Error logging out';
                    message.classList = 'alert alert-danger';
                    setTimeout(() => {
                        message.classList.add('hidden');
                    }, 10000);
            } else {
                if (session == 'ALL') {
                    location.reload();
                } else {
                    const delSession = document.getElementById(session).parentElement.parentElement;
                    if (delSession.classList.contains('last-row')) {
                        delSession.remove();
                        const sessions = document.querySelector('.session-list').children;
                        sessions[sessions.length - 1].classList.add('last-row');
                    } else {
                        delSession.remove();
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error updating password:', error);
        message.innerHTML = 'Error logging out';
        message.classList = 'alert alert-danger';
        setTimeout(() => {
            message.classList.add('hidden');
        }, 10000);
    }
}


async function deleteAccount(password) {
    const message = document.querySelector('#message');
    try {
        const response = await fetch("/delete_account", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'password': password})
        });
        const result = await response.json();

        if (result) {
            if (result['error'] != 'None') {
                if (result['error'] == 'invalid password') {
                    document.querySelector("#delete-account input[name='password']").classList.add('error');
                } else {
                    message.innerHTML = 'Error deleting account';
                    message.classList = 'alert alert-danger';
                    setTimeout(() => {
                        message.classList.add('hidden');
                    }, 10000);
                }
            } else {
                window.location.href = "/";
            }
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        message.innerHTML = 'Error deleting account';
        message.classList = 'alert alert-danger';
        setTimeout(() => {
            message.classList.add('hidden');
        }, 10000);
    }
}

async function downloadRecipes(format, recipes = 'ALL') {
    showLoader();
    const message = document.querySelector('#message');
    try {
        const response = await fetch("/get_recipes", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'format': format, 'recipes': recipes})
        });
        const result = await response.json();

        if (result['error'] == 'None') {
            const blob = new Blob([JSON.stringify(result['data'])], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = result['file'];
            a.click();
            hideLoader();
            URL.revokeObjectURL(url);
        } else {
            hideLoader();
            message.innerHTML = 'Error getting data';
            message.classList = 'alert alert-danger';
            setTimeout(() => {
                message.classList.add('hidden');
            }, 10000);
        }
    } catch (error) {
        hideLoader();
        console.error('Error getting data:', error);
        message.innerHTML = 'Error getting data';
        message.classList = 'alert alert-danger';
        setTimeout(() => {
            message.classList.add('hidden');
        }, 10000);
    }
}

async function updateSettings() {
    fetch("/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort: document.getElementById('recipe-sort').value, image: document.getElementById('image-check').checked })
    });
}