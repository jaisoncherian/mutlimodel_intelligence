import fitz
from PIL import Image, ImageFilter

src = fitz.open("data/sample_pdfs/text_table.pdf")
src[0].get_pixmap(dpi=150).save("data/sample_pdfs/page1.png")

img = Image.open("data/sample_pdfs/page1.png").convert("RGB")
img = img.rotate(2, expand=True, fillcolor="white").filter(ImageFilter.GaussianBlur(1))
img.save("data/sample_pdfs/scan.pdf")
print("scan.pdf created")
