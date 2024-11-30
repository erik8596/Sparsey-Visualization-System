import torch

# Check if MPS is available
if torch.backends.mps.is_available():
    device = torch.device('mps')
    print("MPS is available! Using MPS device.")
else:
    device = torch.device('cpu')
    print("MPS not available. Using CPU instead.")

# Create two large matrices on the MPS device
N = 10000  # Size of the matrix
A = torch.rand(N, N, device=device)
B = torch.rand(N, N, device=device)

# Perform matrix multiplication (A * B)
C = torch.matmul(A, B)

# Optionally, move the result to CPU and print the shape
C_cpu = C.cpu()
print(f"Resulting matrix shape: {C_cpu.shape}")
