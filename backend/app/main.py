from fastapi import FastAPI, UploadFile, Form


app = FastAPI()

@app.get("/")
def root():
    return {"message": "Backend is running ✅"}
