from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version("fileclip")
except PackageNotFoundError:
    __version__ = "0.0.0"

def main() -> None:
    print("Hello from fileclip!")
