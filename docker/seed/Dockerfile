FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir oracledb bcrypt requests
COPY seed-admin.py .
CMD ["python", "seed-admin.py"]
