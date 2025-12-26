#!/bin/bash
# Script para reiniciar el contenedor Docker de Next.js y reconstruir la imagen si es necesario
# Uso: ./restart_next.sh [build]
# Si pasas el argumento 'build', también reconstruye la imagen

CONTAINER=preventa-app
IMAGE=preventa-app
PORT=3000

# Detener y eliminar el contenedor si existe
docker stop $CONTAINER 2>/dev/null || true
docker rm $CONTAINER 2>/dev/null || true

# Si se pasa 'build' como argumento, reconstruir la imagen
echo "[INFO] Usando imagen: $IMAGE"
if [ "$1" == "build" ]; then
  echo "[INFO] Reconstruyendo imagen Docker..."
  docker build -t $IMAGE . || { echo "[ERROR] Falló el build"; exit 1; }
fi

# Iniciar el contenedor
echo "[INFO] Iniciando contenedor..."
docker run -d --name $CONTAINER -p $PORT:3000 $IMAGE

echo "[INFO] Listo. Contenedor en ejecución:"
docker ps | grep $CONTAINER
