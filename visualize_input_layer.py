import os
import numpy as np
from PIL import Image
import plotly.graph_objects as go
import torchvision.transforms as T

def load_sample_images(dataset_path, num_samples=1):
    """Loads a single sample image from the dataset path."""
    images = []
    labels = []
    
    for label in range(10):
        folder_path = os.path.join(dataset_path, str(label))
        if not os.path.exists(folder_path):
            continue
        
        # Load one image from this folder
        for i, filename in enumerate(os.listdir(folder_path)):
            if i >= num_samples:
                break
            image_path = os.path.join(folder_path, filename)
            try:
                with Image.open(image_path) as img:
                    images.append(img.copy())  # Copy the image to work outside of 'with' context
                    labels.append(label)
            except Exception as e:
                print(f"Error loading image {image_path}: {e}")
    
    return images, labels

def preprocess_images(images):
    """Preprocess the images by resizing to 8x8 and converting to tensor with binarization."""
    transform = T.Compose([
        T.Resize((8, 8)),
        T.ToTensor(),
        lambda x: (x > 0.5).float()  # Binarization threshold at 0.5
    ])
    
    preprocessed_images = []
    for img in images:
        try:
            preprocessed_image = transform(img).squeeze().numpy()
            preprocessed_images.append(preprocessed_image)
        except Exception as e:
            print(f"Error processing image: {e}")

    return preprocessed_images

def get_input_layer_traces(preprocessed_images, z_position_input=0, skeleton_center_x=0, skeleton_center_y=0, hex_size=1):
    """Generate traces for the binarized input images as hexagons aligned tightly with no spacing."""
    traces = []
    # Size of each hexagon is passed in as `hex_size` to match the MAC size exactly.
    spacing = hex_size  # No additional spacing, just use hex size to align tightly

    # Calculate the offsets for centering the input layer
    input_width = 8
    input_height = 8

    x_offset = skeleton_center_x - ((input_width - 1) * 1.5 * spacing) / 2
    y_offset = skeleton_center_y - ((input_height - 1) * (np.sqrt(3) * spacing)) / 2

    # Generate hexagons for the input layer, matching the MAC size and aligned with no spacing
    for image in preprocessed_images:
        if image.shape != (8, 8):
            print(f"Warning: Image shape is not 8x8, but {image.shape}")
            continue  # Skip images that are not of the expected size

        for row in range(8):
            for col in range(8):
                # Calculate the center of each hexagon in a tightly packed hexagonal grid pattern
                center_x = col * 1.5 * spacing + x_offset
                center_y = row * (np.sqrt(3) * spacing) + y_offset
                if col % 2 == 1:  # Offset for odd columns to align hexagons in a staggered pattern
                    center_y += np.sqrt(3) * spacing / 2

                # Determine color based on the binarized value (0 or 1)
                color = '#000000' if image[row, col] == 0 else '#FFFFFF'

                # Create the vertices for the hexagon
                angles = np.linspace(0, 2 * np.pi, 7, endpoint=True)
                x = center_x + hex_size * np.cos(angles)
                y = center_y + hex_size * np.sin(angles)
                z = [z_position_input] * len(x)

                # Add the hexagon trace as a filled polygon using Mesh3d
                traces.append(go.Mesh3d(
                    x=x,
                    y=y,
                    z=z,
                    color=color,
                    opacity=1.0,
                    flatshading=True
                ))

                # Add borders to the hexagons for the input layer
                traces.append(go.Scatter3d(
                    x=x,
                    y=y,
                    z=z,
                    mode='lines',
                    line=dict(color='blue', width=3),  # Set the border color to blue and adjust the line width
                    opacity=1.0
                ))

    return traces
