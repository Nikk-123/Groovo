from flask import Flask, request, jsonify
from pymongo import MongoClient
import os
try:
    import cv2
    import numpy as np
    import face_recognition
    from scipy.spatial.distance import cosine
    FACE_LIB_AVAILABLE = True
except ImportError:
    FACE_LIB_AVAILABLE = False
    cv2 = None
    np = None
    face_recognition = None
    cosine = None

import pickle
import base64
import logging
from dotenv import load_dotenv

# Flask app setup
app = Flask(__name__)
app.secret_key = 'FaceServiceKey'
logging.basicConfig(level=logging.INFO)

# Load environment variables (for local development)
load_dotenv()

# MongoDB setup
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    logging.error("MONGO_URI not found")
    exit(1)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, connectTimeoutMS=20000)
db = client.get_database('music_app')

# Directories
UPLOAD_FOLDER = '/tmp/Uploads'  # Use /tmp for ephemeral storage on Railway
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def train_and_save_model(username, user_folder):
    """Load images, generate face encodings using face_recognition, save as .pkl file in MongoDB, and delete frames."""
    if not FACE_LIB_AVAILABLE:
        raise Exception("Face recognition libraries not available")

    encodings = []
    
    for i in range(100):
        frame_path = os.path.join(user_folder, f'frame_{i}.jpg')
        if not os.path.exists(frame_path):
            logging.warning(f"Frame {frame_path} not found")
            continue
        try:
            img = cv2.imread(frame_path)
            if img is None:
                logging.warning(f"Failed to load image {frame_path}")
                continue
            # Convert BGR (OpenCV) to RGB (face_recognition)
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            # Get face encodings (returns list of encodings, take first if available)
            face_encodings = face_recognition.face_encodings(rgb_img)
            if face_encodings:
                encodings.append(face_encodings[0])
        except Exception as e:
            logging.error(f"Error processing frame {i} for {username}: {str(e)}")
            continue
    
    if not encodings:
        raise Exception("No valid face encodings generated")
    
    # Average the encodings
    avg_encoding = np.mean(encodings, axis=0)
    
    try:
        model_data = {'username': username, 'embedding': avg_encoding.tolist()}
        model_pickle = pickle.dumps(model_data)
        model_base64 = base64.b64encode(model_pickle).decode('utf-8')
        db.models.update_one(
            {'username': username},
            {'$set': {'model_data': model_base64}},
            upsert=True
        )
        logging.info(f"Model for {username} saved to MongoDB")
    except Exception as e:
        logging.error(f"Error saving model to MongoDB for {username}: {str(e)}")
        raise
    
    try:
        for i in range(100):
            frame_path = os.path.join(user_folder, f'frame_{i}.jpg')
            if os.path.exists(frame_path):
                os.remove(frame_path)
        if os.path.exists(user_folder) and not os.listdir(user_folder):
            os.rmdir(user_folder)
    except Exception as e:
        logging.error(f"Error deleting frames for {username}: {str(e)}")

@app.route('/upload_frames', methods=['POST'])
def upload_frames():
    if not FACE_LIB_AVAILABLE:
        return jsonify({'status': 'error', 'message': 'Face recognition libraries not available'}), 503

    data = request.get_json()
    frames = data.get('frames', [])
    username = data.get('username', 'unknown')
    
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], username)
    if not os.path.exists(user_folder):
        os.makedirs(user_folder)
    
    for i, frame in enumerate(frames):
        frame_data = frame.split(',')[1]
        frame_bytes = base64.b64decode(frame_data)
        frame_path = os.path.join(user_folder, f'frame_{i}.jpg')
        with open(frame_path, 'wb') as f:
            f.write(frame_bytes)
    
    try:
        train_and_save_model(username, user_folder)
        return jsonify({'status': 'success', 'message': f'{len(frames)} frames saved and model trained'})
    except Exception as e:
        logging.error(f"Error processing frames for {username}: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error processing frames'}), 500

@app.route('/match_face', methods=['POST'])
def match_face():
    if not FACE_LIB_AVAILABLE:
        return jsonify({'status': 'error', 'message': 'Face recognition libraries not available'}), 503

    try:
        data = request.get_json()
        frame = data.get('frame')
        if not frame:
            return jsonify({'status': 'error', 'message': 'No frame provided'}), 400
        
        frame_data = frame.split(',')[1]
        frame_bytes = base64.b64decode(frame_data)
        nparr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Convert BGR to RGB for face_recognition
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        face_encodings = face_recognition.face_encodings(rgb_img)
        if not face_encodings:
            return jsonify({'status': 'error', 'message': 'No face detected'})
        
        live_encoding = face_encodings[0]
        
        best_match = None
        best_score = float('inf')
        threshold = 0.6  # face_recognition's default tolerance for face comparison
        
        models = db.models.find()
        for model in models:
            try:
                model_pickle = base64.b64decode(model['model_data'])
                model_data = pickle.loads(model_pickle)
                stored_encoding = np.array(model_data['embedding'])
                username = model_data['username']
                
                # Use cosine distance for consistency with original code
                score = cosine(live_encoding, stored_encoding)
                if score < best_score:
                    best_score = score
                    best_match = username
            except Exception as e:
                logging.error(f"Error processing model for {model.get('username', 'unknown')}: {str(e)}")
                continue
        
        if best_score < threshold:
            return jsonify({'status': 'success', 'username': best_match, 'verified': True})
        else:
            return jsonify({'status': 'success', 'username': 'No Match', 'verified': False})
            
    except Exception as e:
        logging.error(f"Error matching face: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error matching face'}), 500

@app.route('/delete_model', methods=['POST'])
def delete_model():
    username = request.json.get('username')
    if not username:
        return jsonify({'status': 'error', 'message': 'Username required'}), 400
    
    try:
        result = db.models.delete_one({'username': username})
        if result.deleted_count > 0:
            return jsonify({'status': 'success', 'message': 'Face model deleted successfully'})
        else:
            return jsonify({'status': 'warning', 'message': 'No face model found to delete'})
    except Exception as e:
        logging.error(f"Error deleting face model for {username}: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Error deleting face model'}), 500

@app.route('/check_model', methods=['POST'])
def check_model():
    username = request.json.get('username')
    if not FACE_LIB_AVAILABLE:
        return jsonify({'has_model': False})

    if not username:
        return jsonify({'has_model': False, 'message': 'Username required'}), 400
    try:
        model = db.models.find_one({'username': username})
        logging.info(f"Checked model for {username}: {'Found' if model else 'Not found'}")
        return jsonify({'has_model': bool(model)})
    except Exception as e:
        logging.error(f"Error checking model for {username}: {str(e)}")
        return jsonify({'has_model': False, 'message': str(e)}), 500
        
@app.route('/', methods=['GET'])
def home():
    return jsonify({'status': 'success', 'message': 'Face recognition service is running'})
         
if __name__ == "__main__":
    # Only run the development server if not running under gunicorn
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=False, use_reloader=False, host='0.0.0.0', port=port)
