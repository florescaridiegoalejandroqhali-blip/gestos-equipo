// ==========================================
// SERVIDOR - GESTOS EN EQUIPO
// ==========================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// SALAS: cada sala tiene hasta 5 personas
// ==========================================
const salas = {};  // { nombreSala: [socket1, socket2, ...] }

io.on('connection', (socket) => {
  console.log('✅ Usuario conectado:', socket.id);

  // ---- UNIRSE A UNA SALA ----
  socket.on('unirse', ({ sala, nombre }) => {
    // Validaciones
    if (!sala || !nombre) {
      socket.emit('error-sala', 'Faltan datos (sala o nombre)');
      return;
    }

    // Crear sala si no existe
    if (!salas[sala]) salas[sala] = [];

    // Verificar que no esté llena (máximo 5)
    if (salas[sala].length >= 5) {
      socket.emit('error-sala', 'La sala está llena (máximo 5 personas)');
      return;
    }

    // Verificar que no esté el mismo nombre
    if (salas[sala].some(s => s.nombre === nombre)) {
      socket.emit('error-sala', 'Ya hay alguien con ese nombre en la sala');
      return;
    }

    // Unirse
    socket.join(sala);
    socket.sala = sala;
    socket.nombre = nombre;

    // Enviar la lista de usuarios actuales a quien entra
    const usuariosEnSala = salas[sala].map(s => ({
      id: s.id,
      nombre: s.nombre
    }));

    socket.emit('lista-usuarios', usuariosEnSala);

    // Agregar a la lista
    salas[sala].push({
      id: socket.id,
      nombre: nombre
    });

    // Avisar a los demás que entró alguien nuevo
    socket.to(sala).emit('nuevo-usuario', {
      id: socket.id,
      nombre: nombre
    });

    console.log(`👥 ${nombre} entró a "${sala}" (${salas[sala].length}/5)`);

    // Actualizar contador para todos
    io.to(sala).emit('actualizar-contador', salas[sala].length);
  });

  // ---- GESTO DETECTADO ----
  socket.on('gesto', ({ gesto }) => {
    if (socket.sala && gesto) {
      io.to(socket.sala).emit('gesto-recibido', {
        id: socket.id,
        nombre: socket.nombre,
        gesto: gesto
      });
    }
  });

  // ---- MENSAJE DE CHAT (opcional) ----
  socket.on('mensaje', ({ texto }) => {
    if (socket.sala && texto) {
      io.to(socket.sala).emit('mensaje-recibido', {
        id: socket.id,
        nombre: socket.nombre,
        texto: texto,
        hora: new Date().toLocaleTimeString()
      });
    }
  });

  // ---- DESCONEXIÓN ----
  socket.on('disconnect', () => {
    if (socket.sala && salas[socket.sala]) {
      // Quitar de la lista
      salas[socket.sala] = salas[socket.sala].filter(s => s.id !== socket.id);

      // Avisar a los demás
      io.to(socket.sala).emit('usuario-salio', {
        id: socket.id,
        nombre: socket.nombre
      });

      // Actualizar contador
      io.to(socket.sala).emit('actualizar-contador', salas[socket.sala].length);

      // Borrar sala si queda vacía
      if (salas[socket.sala].length === 0) {
        delete salas[socket.sala];
        console.log(`🗑️ Sala "${socket.sala}" eliminada (vacía)`);
      }

      console.log('❌ Usuario desconectado:', socket.nombre);
    } else {
      console.log('❌ Usuario desconectado:', socket.id);
    }
  });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
const PUERTO = process.env.PORT || 3000;

server.listen(PUERTO, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  🚀 SERVIDOR DE GESTOS INICIADO');
  console.log('═══════════════════════════════════════');
  console.log(`  🌐 Puerto: ${PUERTO}`);
  console.log(`  💻 Local:  http://localhost:${PUERTO}`);
  console.log('  📡 Esperando conexiones...');
  console.log('═══════════════════════════════════════');
  console.log('');
});