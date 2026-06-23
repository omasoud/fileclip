from importlib import resources


def test_static_assets_are_available_as_package_data() -> None:
    static = resources.files("fileclip").joinpath("static")

    assert static.joinpath("index.html").is_file()
    assert static.joinpath("app.css").is_file()
    assert static.joinpath("app.js").is_file()
