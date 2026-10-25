const form = document.querySelector('#login');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  const message = document.querySelector('#error');
  button.disabled = true;
  message.textContent = '';
  try {
    const response = await fetch('/api/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Could not sign in. Try again.');
    window.location.replace('/');
  } catch (error) {
    message.textContent = error.name === 'TypeError' || error.name === 'TimeoutError' ? 'Could not connect. Check your connection and try again.' : error.message;
    button.disabled = false;
  }
});
