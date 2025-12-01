from fastapi import FastAPI, UploadFile, Form
from app.routes.generate import router as stl_router


app = FastAPI()
@app.get("/")
def root():
    return {"message": "Backend is running ✅"}

app.include_router(stl_router)