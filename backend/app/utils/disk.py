import os
import shutil
import time
import ctypes
import platform

def get_free_space_mb(path: str) -> float:
    """Returns free space in MB for the given path."""
    if platform.system() == "Windows":
        free_bytes = ctypes.c_ulonglong(0)
        ctypes.windll.kernel32.GetDiskFreeSpaceExW(ctypes.c_wchar_p(path), None, None, ctypes.pointer(free_bytes))
        return free_bytes.value / (1024 * 1024)
    else:
        st = os.statvfs(path)
        return (st.f_bavail * st.f_frsize) / (1024 * 1024)

def safe_proactive_cleanup(upload_dir: str):
    """
    Conserved cleanup of temporary files.
    Only deletes files older than 6 hours in the temp directory.
    """
    temp_dir = os.path.join(upload_dir, "temp")
    if not os.path.exists(temp_dir):
        return

    now = time.time()
    six_hours = 6 * 3600

    print(f"Running safe proactive cleanup in {temp_dir}...")
    
    # Clean up temp subdirectories
    for item in os.listdir(temp_dir):
        item_path = os.path.join(temp_dir, item)
        # Skip the currently used zip or recently modified folders
        try:
            if os.path.getmtime(item_path) < now - six_hours:
                print(f"Cleaning up old temp item: {item}")
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path, ignore_errors=True)
                else:
                    os.remove(item_path)
        except OSError:
            continue

def ensure_free_space(path: str, required_mb: float = 500.0):
    """
    Check if free space is below threshold and trigger cleanup.
    """
    free_mb = get_free_space_mb(path)
    if free_mb < required_mb:
        # Trigger cleanup if path is or contains 'uploads'
        upload_dir = path if os.path.basename(path) == "uploads" else path
        safe_proactive_cleanup(upload_dir)
        
        # Check again
        free_mb = get_free_space_mb(path)
        if free_mb < required_mb:
            print(f"Warning: Low disk space! {free_mb:.2f} MB remaining.")
    
    return free_mb
