# Guía de Despliegue - Software Comercial

## Flujo completo para actualizar la aplicación en producción

### 1️⃣ En tu máquina local (desarrollo)

#### Paso 1: Verificar cambios
```bash
git status
```

#### Paso 2: Agregar archivos modificados
```bash
git add .
```

#### Paso 3: Hacer commit con un mensaje descriptivo
```bash
git commit -m "Descripción de los cambios realizados"
```

#### Paso 4: Subir cambios a Git
```bash
git push
```

---

### 2️⃣ En el servidor (producción)

#### Conectarse al servidor
```bash
ssh root@IP_DEL_SERVIDOR
```

#### Navegar a la carpeta del proyecto
```bash
cd /ruta/del/proyecto/software-comercial
```

#### Ejecutar el script de despliegue

**Opción A: Solo actualizar código y desplegar (MÁS COMÚN)**
```bash
./deploy.sh --pull --build
```
Esto hará:
- Git pull (respaldando y restaurando .env.local)
- Reconstruir imagen Docker
- Reiniciar contenedor

**Opción B: Solo reiniciar con la imagen actual**
```bash
./deploy.sh
```
Esto solo reinicia el contenedor sin hacer pull ni rebuild.

**Opción C: Despliegue completo (pull + build sin backup)**
```bash
./deploy.sh --pull --build --no-backup
```

---

## Comandos útiles

### Ver logs de la aplicación
```bash
docker logs -f preventa-app
```

### Ver estado del contenedor
```bash
docker ps
```

### Verificar si el servidor responde
```bash
curl http://localhost:3000
```

### Verificar HTTPS (desde otra máquina)
```bash
curl -k https://IP_PUBLICA
```

### Reiniciar Nginx
```bash
sudo systemctl reload nginx
```

---

## Troubleshooting

### Error: .env.local fue sobrescrito
Si olvidaste hacer backup de .env.local, puedes recuperarlo:
```bash
mv .env.local.bak .env.local
```

### Error: Contenedor no inicia
Ver logs:
```bash
docker logs preventa-app
```

### Error: Puerto ya en uso
```bash
docker ps -a
docker stop preventa-app
docker rm preventa-app
./deploy.sh --build
```

### Limpiar imágenes antiguas
```bash
docker image prune -a
```

---

## Notas importantes

- El archivo `.env.local` NO se sube a Git (está en .dockerignore).
- Siempre asegúrate de tener el .env.local correcto en el servidor antes de hacer build.
- Si cambias .env.local, debes hacer rebuild (--build).
- El script hace backup automático de .env.local durante git pull.

---

## Flujo rápido (para copiar/pegar)

### En local:
```bash
git add .
git commit -m "Actualización de [descripción]"
git push
```

### En servidor:
```bash
ssh root@IP_DEL_SERVIDOR
cd /ruta/del/proyecto/software-comercial
./deploy.sh --pull --build
```

¡Listo! 🚀
