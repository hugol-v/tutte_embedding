# tutte_embedding

Tutte's theorem states that any 3-connected planar graph can be embedded in the plane without edge crossings by fixing the vertices of the outer face to a convex polygon and positioning the remaining vertices to satisfy harmonic conditions.

This project demonstrates this process through an interactive interface where users can:

    - Generate random (probably) 3-connected planar graphs.
    - Fix the outer face.
    - Observe how the inner vertices find their equilibrium positions

We can think of it as a spring system where the outer face is fixed and the inner vertices are free to move. The springs are all ideal and have the same spring constant. The equilibrium positions are found by minimizing the energy of the system.