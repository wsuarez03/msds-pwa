// login.js
async function sha256hex(str){
  const enc = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;

  try {
    const res = await fetch('users.json', {cache:'no-store'});
    if(!res.ok) throw new Error('No se encontró users.json');
    const users = await res.json();
    const hash = await sha256hex(p);
    const user = users.find(x => x.username === u && x.password === hash);
    if(!user){
      document.getElementById('msg').textContent = 'Usuario o contraseña incorrectos';
      return;
    }
    // Guardar sesión (solo role y username)
    sessionStorage.setItem('msds_user', JSON.stringify({ username: user.username, role: user.role }));
    // Redirigir
    if(user.role === 'admin') location.href = 'admin_qr.html';
    else location.href = 'index.html';
  } catch(err){
    console.error(err);
    document.getElementById('msg').textContent = 'Error al iniciar sesión. Revisa consola.';
  }
});
