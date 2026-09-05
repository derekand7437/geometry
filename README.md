# Compass and Proof

A study site for first-semester (10th grade) geometry: a 21-day guided path that starts from
points and lines and ends at circles, area and volume, plus a reference library with drawn
figures, a live right-triangle solver and a two-column proof builder.

The whole site is one file — `index.html` — with its CSS and JavaScript inside it. No build step,
no dependencies, no server code. Every figure is drawn as SVG by the page itself and redraws for
each new problem. Progress saves in each visitor's own browser, so the site remembers which day
they are on.

## The 21 days

Points, lines and notation · classifying angles · complementary and supplementary ·
vertical angles and linear pairs · parallel lines and a transversal · finding angle measures ·
solving for x · the triangle angle sum · SSS and SAS · ASA, AAS and HL · what does not prove
congruence · the Pythagorean theorem · missing legs · special right triangles · similarity and
scale factor · perimeter and area ratios · distance · midpoint and slope · central and inscribed
angles · arc length and sector area · area and volume.

## Publishing it

Push this folder to a GitHub repo, then **Settings → Pages** → *Deploy from a branch*,
branch `main`, folder `/ (root)`. The site appears at
`https://YOUR-USERNAME.github.io/REPO-NAME/`.

## Editing it

Open `index.html`. The daily lessons are the `PLAN` array near the bottom of the `<script>`;
the practice problems come from the generator functions just above it.
