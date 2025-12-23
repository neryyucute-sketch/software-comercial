# Despliegue en Huawei Cloud con Docker

1. **Clona el repo o haz pull:**

```sh
git clone <REPO_URL> # o git pull
cd software-comercial
```

2. **Copia/ajusta tu .env.local** (si es necesario)

3. **Construye la imagen Docker:**

```sh
docker build -t preventa-app:latest .
```

4. **Ejecuta el contenedor:**

```sh
docker run -d --restart=always --name preventa-app -p 3000:3000 --env-file .env.local preventa-app:latest
```

5. **(Opcional) Limpieza de contenedores viejos:**

```sh
docker stop preventa-app || true
# docker rm preventa-app || true
# docker rmi preventa-app:old || true
```

6. **Accede a la app:**

- http://<IP_SERVIDOR>:3000

---

**Notas:**
- Asegúrate de tener Docker instalado en el servidor.
- Si usas proxy/reverse proxy (Nginx, etc.), ajusta el puerto según corresponda.
- El build usa pnpm (ya incluido en el Dockerfile).
- Si necesitas persistencia, monta volúmenes para logs o archivos estáticos.
