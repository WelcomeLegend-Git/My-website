const fs = require('fs');
fetch('https://jee-study-backend.onrender.com/trpc/authApi.login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test_render_1@example.com', password: 'testpassword' })
})
  .then(res => res.text())
  .then(t => {
    fs.writeFileSync('render_error_utf8.txt', t, 'utf-8');
    console.log('Saved to render_error_utf8.txt');
  })
  .catch(console.error);
