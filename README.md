# The Sparsey Visualization System (SVS)

A Python 3.12 + Three.js web application that visualises the lifelong‑learning
mechanisms of **Sparsey**.  
This README walks a new team from zero to a running system, shows how to run the
automated test suites, and explains exactly how to bundle your deliverables
(.zip, video clips, reports, slides, poster).

-----------------------------------------------------------------------------------

## 1 . Quick‑Start (5 shell commands)

- `git clone https://github.com/dhruvshr/sparseypy_visualizer.git  SVS`
- `cd SVS`
- `python -m venv venv                    # create venv`
- `source venv/bin/activate               # if Windows: .\venv\Scripts\Activate.ps1`
- `pip install -r requirements.txt        # install the requirements for launching SVS`
- `python main.py                         # launches Flask on http://127.0.0.1:5000`



## 2 . Navigate to localhost http://127.0.0.1:5000 (or whichever server configured in .env file) in your browser



## 3 . An empty dashboard with two drop‑downs (“Project” + “Run”) will appear.
Select a W&B project/run and press the 'Visualize' button to render the Sparsey
model for that run.
