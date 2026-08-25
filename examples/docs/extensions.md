# Chemistry & physics

These lean on engine extensions — MathJax (physics + mhchem via its font extension), KaTeX
(mhchem contrib, loaded by default), and Temml (both built in). The webc engine renders
placeholders here — expected.

Chemistry with mhchem:

$$\ce{2H2 + O2 -> 2H2O}$$

$$\ce{CO2 + C -> 2CO}$$

Units and isotopes: $\pu{9.81 m/s^2}$, $\ce{^{227}_{90}Th+}$.

Physics notation (MathJax/Temml):

$$\dv{f}{x} \qquad \pdv[2]{\Psi}{t} \qquad \expval{\hat{H}}{\psi}$$

Quantum states with braket: $\bra{\phi}\ket{\psi}$, $\braket{\phi|\psi}$.

Cancellation and coloring:

$$\frac{\cancel{a}\,b}{\cancel{a}\,c} = \frac{b}{c} \qquad {\color{red} x} + {\color{teal} y}$$

Chemistry inline in prose: water is $\ce{H2O}$ and sulfate is $\ce{SO4^2-}$.
