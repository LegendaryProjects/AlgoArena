from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from deepface import DeepFace
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import shutil
import os

app = FastAPI()

# --- 1. PLAGIARISM DETECTION ENDPOINT ---
class CodeComparison(BaseModel):
    code1: str
    code2: str

@app.post("/check-plagiarism")
async def check_plagiarism(data: CodeComparison):
    try:
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform([data.code1, data.code2])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return {
            "similarity_score": float(similarity),
            "is_suspect": bool(similarity > 0.85) # Flags if 85% or more similar
        }
    except Exception as e:
        return {"error": str(e)}

# --- 2. PROCTORING (FACE VERIFICATION) ENDPOINT ---
@app.post("/verify-face")
async def verify_face(reference_img: UploadFile = File(...), current_img: UploadFile = File(...)):
    ref_path = f"temp_ref_{reference_img.filename}"
    curr_path = f"temp_curr_{current_img.filename}"
    
    with open(ref_path, "wb") as buffer:
        shutil.copyfileobj(reference_img.file, buffer)
    with open(curr_path, "wb") as buffer:
        shutil.copyfileobj(current_img.file, buffer)
        
    try:
        # DeepFace compares the two images
        result = DeepFace.verify(img1_path=ref_path, img2_path=curr_path, enforce_detection=False)
        return {
            "is_same_person": result["verified"],
            "distance": result["distance"]
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        # Clean up temporary images
        if os.path.exists(ref_path): os.remove(ref_path)
        if os.path.exists(curr_path): os.remove(curr_path)