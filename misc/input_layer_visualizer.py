import os
import numpy as np
from PIL import Image
import plotly.graph_objects as go
import torchvision.transforms as T

def load_sample_images(dataset_path, num_samples=1):
    """Loads sample images from the dataset."""
    images, labels = [], []
    for label in range(10):
        folder_path = os.path.join(dataset_path, str(label))
        if not os.path.exists(folder_path):
            continue
        for i, filename in enumerate(os.listdir(folder_path)):
            if i >= num_samples:
                break
            image_path = os.path.join(folder_path, filename)
            with Image.open(image_path) as img:
                images.append(img.copy())
                labels.append(label)
    return images, labels

def preprocess_images(images):
    """Preprocesses images (resize, tensorize, binarize)."""
    transform = T.Compose([
        T.Resize((8, 8)),
        T.ToTensor(),
        lambda x: (x > 0.5).float()
    ])
    return [transform(img).squeeze().numpy() for img in images]

def get_input_layer_traces(preprocessed_images, z_position_input=0, hex_size=1):
    """Generate traces for input layer visualization."""
    traces = []
    spacing = hex_size
    input_width, input_height = 8, 8
    x_offset = -((input_width - 1) * 1.5 * spacing) / 2
    y_offset = -((input_height - 1) * (np.sqrt(3) * spacing)) / 2

    for image in preprocessed_images:
        for row in range(input_height):
            for col in range(input_width):
                center_x = col * 1.5 * spacing + x_offset
                center_y = row * (np.sqrt(3) * spacing) + y_offset
                if col % 2 == 1:
                    center_y += np.sqrt(3) * spacing / 2
                color = '#000000' if image[row, col] == 0 else '#FFFFFF'
                angles = np.linspace(0, 2 * np.pi, 7)
                x = center_x + hex_size * np.cos(angles)
                y = center_y + hex_size * np.sin(angles)
                z = [z_position_input] * len(x)
                traces.append(go.Mesh3d(x=x, y=y, z=z, color=color, opacity=1.0, flatshading=True))
                traces.append(go.Scatter3d(x=x, y=y, z=z, mode='lines', line=dict(color='blue', width=3)))
    return traces
