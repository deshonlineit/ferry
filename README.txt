FERRYTELECOM HOMEPAGE REFERENCE REDESIGN

Files included:
- assets/css/home-reference.css
- assets/js/home-reference.js
- assets/img/home/hero-reference.jpg
- assets/img/home/wholesale-reference.jpg
- assets/img/home/logo-reference.png
- apply-home-reference.sh

Apply:
1. Extract this ZIP into your project root.
2. In Git Bash from the project root run:
   bash apply-home-reference.sh
3. Then commit/push:
   git add . && git commit -m "Match homepage to premium B2B reference" && git push

The redesign affects only the homepage. Existing shop/product/account backend/API behavior stays untouched.
Responsive sizing uses fixed values with explicit 1199/991/767/480 breakpoints; no clamp() is used in the new homepage CSS.
