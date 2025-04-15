import deepface
import cv2
import numpy as np
img = np.zeros((224, 224, 3), dtype=np.uint8)
cv2.imwrite('temp.jpg', img)
from deepface import DeepFace
DeepFace.represent(img_path='temp.jpg', model_name='VGG-Face', enforce_detection=False)
import os
if os.path.exists('temp.jpg'):
    os.remove('temp.jpg')