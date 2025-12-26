#!/bin/bash
# Script para actualizar y desplegar la app Next.js en Docker
# Uso: ./deploy.sh [opciones]
# Opciones:
#   --pull       : Hacer git pull antes de build
#   --build      : Reconstruir la imagen Docker
#   --no-backup  : No hacer backup del .env.local
# Sin argumentos: solo reinicia el contenedor con la imagen actual

set -e  # Salir si hay error

CONTAINER=preventa-app
IMAGE=preventa-app
PORT=3000

# Colores para mensajes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables de control
DO_PULL=false
DO_BUILD=false
DO_BACKUP=true

# Procesar argumentos
for arg in "$@"; do
  case $arg in
    --pull)
      DO_PULL=true
      ;;
    --build)
      DO_BUILD=true
      ;;
    --no-backup)
      DO_BACKUP=false
      ;;
    *)
      echo -e "${RED}[ERROR] Argumento desconocido: $arg${NC}"
      echo "Uso: ./deploy.sh [--pull] [--build] [--no-backup]"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Script - Preventa App${NC}"
echo -e "${GREEN}========================================${NC}"

# 1. Git pull si se solicita
if [ "$DO_PULL" = true ]; then
  echo -e "${YELLOW}[PASO 1/4] Actualizando código desde Git...${NC}"
  
  # Backup de .env.local si existe
  if [ "$DO_BACKUP" = true ] && [ -f .env.local ]; then
    echo "[INFO] Haciendo backup de .env.local..."
    cp .env.local .env.local.bak
  fi
  
  git pull --rebase || { 
    echo -e "${RED}[ERROR] Falló git pull${NC}"; 
    exit 1; 
  }
  
  # Restaurar .env.local si fue respaldado
  if [ "$DO_BACKUP" = true ] && [ -f .env.local.bak ]; then
    echo "[INFO] Restaurando .env.local..."
    mv .env.local.bak .env.local
  fi
  
  echo -e "${GREEN}✓ Código actualizado${NC}"
else
  echo -e "${YELLOW}[PASO 1/4] Saltando git pull${NC}"
fi

# 2. Detener y eliminar contenedor actual
echo -e "${YELLOW}[PASO 2/4] Deteniendo contenedor actual...${NC}"
docker stop $CONTAINER 2>/dev/null && echo "[INFO] Contenedor detenido" || echo "[INFO] Contenedor no estaba corriendo"
docker rm $CONTAINER 2>/dev/null && echo "[INFO] Contenedor eliminado" || echo "[INFO] Contenedor no existía"
echo -e "${GREEN}✓ Contenedor limpiado${NC}"

# 3. Build de imagen si se solicita
if [ "$DO_BUILD" = true ]; then
  echo -e "${YELLOW}[PASO 3/4] Reconstruyendo imagen Docker...${NC}"
  docker build -t $IMAGE . || { 
    echo -e "${RED}[ERROR] Falló el build de Docker${NC}"; 
    exit 1; 
  }
  echo -e "${GREEN}✓ Imagen reconstruida${NC}"
else
  echo -e "${YELLOW}[PASO 3/4] Usando imagen existente: $IMAGE${NC}"
fi

# 4. Iniciar contenedor
echo -e "${YELLOW}[PASO 4/4] Iniciando contenedor...${NC}"
docker run -d --name $CONTAINER -p $PORT:3000 $IMAGE || {
  echo -e "${RED}[ERROR] Falló al iniciar el contenedor${NC}"
  exit 1
}

echo -e "${GREEN}✓ Contenedor iniciado${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment completado exitosamente${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Estado del contenedor:"
docker ps | grep $CONTAINER || echo -e "${RED}[ERROR] Contenedor no está corriendo${NC}"
echo ""
echo "Ver logs: docker logs -f $CONTAINER"
