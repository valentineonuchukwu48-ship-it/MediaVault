import fs from 'fs';
import path from 'path';

// Generate crisp SVG of the exact math worksheet from the user's Facebook post screenshot
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200" style="background:#ffffff; font-family:'Times New Roman', serif;">
  <style>
    .title { font-size: 15px; fill: #111827; }
    .text { font-size: 14px; fill: #1f2937; line-height: 1.5; }
    .bold { font-weight: bold; }
    .math { font-style: italic; font-family: 'Times New Roman', serif; }
  </style>

  <rect width="900" height="1200" fill="#ffffff" />

  <!-- Top snippet -->
  <text x="60" y="70" class="text">
    <tspan class="bold">Solution:</tspan> The second digit can only be 3 or 7, so the choice quickly narrows down to 23, 27, 33,
  </text>
  <text x="60" y="92" class="text">
    37, 53, 57, 73, and 77. Of these, 27, 33, and 57 are divisible by 3, and 77 by 7, leaving 23, 37,
  </text>
  <text x="60" y="114" class="text">
    53, and 73. It is easy to see that none of these is divisible by 2, 3, 5, or 7, and there is no need
  </text>
  <text x="60" y="136" class="text">
    to look at greater prime divisors since &#8730;77 &lt; 11.
  </text>

  <!-- Problem 8 -->
  <text x="60" y="180" class="text">
    <tspan class="bold">8.</tspan> You own thirteen pairs of socks, all different, and all of the socks are individually jumbled in a
  </text>
  <text x="60" y="202" class="text">
    drawer. One morning you rummage through the drawer and continue to pull out socks until you
  </text>
  <text x="60" y="224" class="text">
    have a matching pair. How many socks must you pull out to guarantee having a matching pair?
  </text>
  <text x="100" y="254" class="text">
    A. 3 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; B. 12 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; C. 13 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; D. 14 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; E. 25
  </text>
  <text x="60" y="290" class="text"><tspan class="bold">Answer:</tspan> (d)</text>
  <text x="60" y="322" class="text">
    <tspan class="bold">Solution:</tspan> You might be unlucky and have the first thirteen socks all different, but then the
  </text>
  <text x="60" y="344" class="text">
    14<tspan dy="-4" font-size="10">th</tspan><tspan dy="4"> has to match one of them.</tspan>
  </text>

  <!-- Problem 9 -->
  <text x="60" y="390" class="text">
    <tspan class="bold">9.</tspan> A jeweler has a 20 gram ring that is 60% gold and 40% silver. He wants to melt it down
  </text>
  <text x="60" y="412" class="text">
    and add enough gold to make it 80% gold. How many grams of gold should be added?
  </text>
  <text x="100" y="442" class="text">
    A. 4 grams &#160;&#160;&#160;&#160;&#160; B. 8 grams &#160;&#160;&#160;&#160;&#160; C. 12 grams &#160;&#160;&#160;&#160;&#160; D. 16 grams &#160;&#160;&#160;&#160;&#160; E. 20 grams
  </text>
  <text x="60" y="478" class="text"><tspan class="bold">Answer:</tspan> (e)</text>
  <text x="60" y="510" class="text"><tspan class="bold">Solution:</tspan></text>
  
  <!-- Equation -->
  <g transform="translate(260, 520)">
    <text x="0" y="20" class="text">Gold concentration = (weight of gold) / (total weight)</text>
    <text x="70" y="50" class="text">0.80 = (20 &#183; 0.60 + x) / (20 + x)</text>
    <text x="60" y="80" class="text">12 + x = 16 + 0.8x</text>
    <text x="68" y="105" class="text">0.2x = 4</text>
    <text x="80" y="130" class="text"><tspan class="bold">x = 20 grams</tspan></text>
  </g>

  <!-- Problem 10 -->
  <text x="60" y="700" class="text">
    <tspan class="bold">10.</tspan> Consider the following game. A referee has cards labeled A, B, C, and D, and places them
  </text>
  <text x="60" y="722" class="text">
    face down in some order. You point to each card in turn, and guess what letter is written on the
  </text>
  <text x="60" y="744" class="text">
    bottom. You guess each of A, B, C, and D exactly once (otherwise there is no chance of getting
  </text>
  <text x="60" y="766" class="text">
    them all right!). You play this game once, and then the referee tells you that you guessed
  </text>
  <text x="60" y="788" class="text">
    exactly n of the letters correctly. Which value of n is not a possible value of n?
  </text>
  <text x="100" y="818" class="text">
    A. 0 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; B. 1 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; C. 2 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; D. 3 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; E. 4
  </text>
  <text x="60" y="854" class="text"><tspan class="bold">Answer:</tspan> (d)</text>
  <text x="60" y="886" class="text">
    <tspan class="bold">Solution:</tspan> If the first three are correct, then by process of elimination the fourth has to be correct
  </text>
  <text x="60" y="908" class="text">
    also. The same reasoning holds no matter when the three correct answers occur.
  </text>

  <!-- Problem 11 -->
  <text x="60" y="955" class="text">
    <tspan class="bold">11.</tspan> Consider the following game. A referee has cards labeled A, B, C, and D, and places them
  </text>
  <text x="60" y="977" class="text">
    face down in some order. You point to each card in turn, and guess what letter is written on the
  </text>
  <text x="60" y="999" class="text">
    bottom. You guess each of A, B, C, and D exactly once (otherwise there is no chance of getting
  </text>
  <text x="60" y="1021" class="text">
    them all right!). You play this game once, and then the referee tells you that you guessed exactly
  </text>
  <text x="60" y="1043" class="text">
    n of the letters correctly. Which value of n is not a possible value of n?
  </text>
  <text x="100" y="1073" class="text">
    A. 0 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; B. 1 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; C. 2 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; D. 3 &#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160; E. 4
  </text>
  <text x="60" y="1109" class="text"><tspan class="bold">Answer:</tspan> (d)</text>
  <text x="60" y="1141" class="text">
    <tspan class="bold">Solution:</tspan> If the first three are correct, then by process of elimination the fourth has to be correct
  </text>
  <text x="60" y="1163" class="text">
    also. The same reasoning holds no matter when the three correct answers occur.
  </text>
</svg>`;

const outputDir = path.resolve('src/assets/images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'fb_math_worksheet.svg'), svg);
console.log('Saved fb_math_worksheet.svg successfully!');
