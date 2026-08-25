# Basics

Inline math: when $a \ne 0$, the equation $ax^2 + bx + c = 0$ has two solutions, given by
$x = {-b \pm \sqrt{b^2-4ac} \over 2a}$.

Display math:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

Bracket delimiters work too — inline \(e^{i\pi} + 1 = 0\) and as a block:

\[
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
\]

Mid-paragraph display math renders inline: the Gaussian integral $$\int e^{-x^2}dx$$ sits
right here in the sentence.

Math fences:

```math
\begin{aligned}
(a+b)^2 &= a^2 + 2ab + b^2 \\
(a-b)^2 &= a^2 - 2ab + b^2
\end{aligned}
```

Currency stays text: it costs $5 and $10, or maybe \$100. Select and copy any formula on
this page — the clipboard gets the original TeX.
