import requests
import os
import sys
import subprocess

GITHUB_REPO = "Nikk-123/Spotify-3.0"  # Change this to your repo
LATEST_RELEASE_API = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
EXE_NAME = "app.exe"  # Change this if your EXE has a different name

def get_latest_release():
    response = requests.get(LATEST_RELEASE_API)
    if response.status_code == 200:
        return response.json()["tag_name"], response.json()["assets"][0]["browser_download_url"]
    return None, None

def update_exe():
    latest_version, download_url = get_latest_release()
    if latest_version is None:
        print("Failed to fetch the latest release.")
        return

    # Download the new EXE
    print("Downloading the latest version...")
    response = requests.get(download_url, stream=True)
    if response.status_code == 200:
        with open(EXE_NAME, "wb") as exe_file:
            for chunk in response.iter_content(chunk_size=1024):
                exe_file.write(chunk)
        print("Update completed! Restarting...")
        restart_program()
    else:
        print("Failed to download update.")

def restart_program():
    """Restart the program after updating."""
    os.execl(sys.executable, sys.executable, *sys.argv)

if __name__ == "__main__":
    update_exe()
