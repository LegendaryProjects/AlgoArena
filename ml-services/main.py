import os
import shutil
import importlib

from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Tell Mac OS to play nice with threads globally
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

app = FastAPI()


class CodeComparison(BaseModel):
    code1: str
    code2: str


@app.post("/check-plagiarism")
def check_plagiarism(data: CodeComparison):
    try:
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform([data.code1, data.code2])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return {
            "similarity_score": float(similarity),
            "is_suspect": bool(similarity > 0.85)
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/verify-face")
def verify_face(reference_img: UploadFile = File(...), current_img: UploadFile = File(...)):
    ref_path = None
    curr_path = None

    try:
        # =================================================================
        # THE ULTIMATE MAC FIX: LAZY LOADING
        # We import DeepFace ONLY when the endpoint is actually called.
        # Uvicorn boots up without touching TensorFlow, avoiding the deadlock.
        # =================================================================
        os.environ["CUDA_VISIBLE_DEVICES"] = "-1"  # Force CPU just in case
        DeepFace = importlib.import_module("deepface").DeepFace
        # =================================================================

        ref_path = f"temp_ref_{reference_img.filename}"
        curr_path = f"temp_curr_{current_img.filename}"

        with open(ref_path, "wb") as buffer:
            shutil.copyfileobj(reference_img.file, buffer)
        with open(curr_path, "wb") as buffer:
            shutil.copyfileobj(current_img.file, buffer)

        result = DeepFace.verify(
            img1_path=ref_path,
            img2_path=curr_path,
            enforce_detection=False,
            detector_backend='opencv'
        )
        return {
            "success": True,
            "is_same_person": result["verified"],
            "distance": result["distance"]
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        if ref_path and os.path.exists(ref_path): os.remove(ref_path)
        if curr_path and os.path.exists(curr_path): os.remove(curr_path)