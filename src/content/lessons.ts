export interface Lesson {
  id: string;
  title: string;
  subject: "linear-algebra" | "calculus" | "applications";
  objectives: string[];
  prerequisites: string[];
  question: string;
  intuition: string;
  foundations: string;
  advanced: string;
  research: string;
  pitfall: string;
  sourceRefs: string[];
}
export const lessons: Record<"linear" | "calculus", Lesson> = {
  linear: {
    id: "transform-space",
    title: "Transform space",
    subject: "linear-algebra",
    objectives: [
      "Predict how a matrix moves a vector",
      "Interpret determinant as signed volume scale",
      "Find a rotation that preserves shape",
    ],
    prerequisites: ["Coordinates", "Multiplication"],
    question: "Can you turn a satellite without stretching it?",
    intuition:
      "A matrix tells each basis arrow where to go. Every other point follows the same rule. Move an arrow and the whole space responds.",
    foundations:
      "The columns of A are the new basis arrows. A vector (x, y, z) becomes x times column 1, plus y times column 2, plus z times column 3. The determinant is signed volume scale.",
    advanced:
      "A rotation satisfies AᵀA = I and det(A) = 1. A zero determinant means at least one direction is lost, so no inverse exists. Eigenvectors retain their line: Av = λv. The displayed eigenpairs cover the invariant xy block only.",
    research:
      "The Frobenius product ‖A‖F ‖A⁻¹‖F is an upper bound on the spectral condition number, not the exact spectral condition number. Near-singular matrices amplify errors in solving Ax = b. An exact SVD-based condition number is planned.",
    pitfall:
      "A determinant of 1 preserves volume, but can still shear or stretch shape. The satellite mission checks the entire target rotation matrix.",
    sourceRefs: ["mit-linear", "three"],
  },
  calculus: {
    id: "touch-change",
    title: "Touch change",
    subject: "calculus",
    objectives: [
      "Predict downhill direction from a gradient",
      "Compare finite and analytic derivatives",
      "Explain safe and unstable descent steps",
    ],
    prerequisites: ["Coordinates", "Function values", "Slope"],
    question: "How can a particle find lower energy?",
    intuition:
      "The gradient points toward the fastest local increase. Take a small step in the opposite direction to move downhill. A big step can jump past the bottom.",
    foundations:
      "For E(x,y) = (x² + 2y²)/2, the gradient is (x, 2y). One descent step subtracts α times the gradient. Here x and y, step size α, and energy are all unitless model quantities.",
    advanced:
      "The bowl has Hessian diag(1,2). Constant-step descent converges for 0 < α < 1. The two-valley surface has minima at (−1,0) and (1,0) and a saddle at (0,0). A zero gradient alone does not imply a minimum.",
    research:
      "Real ML loss surfaces depend on many parameters. This toy landscape has exactly two parameters; it is not a complete picture of high-dimensional training. Nonconvex methods can converge to stationary points and depend on initialization.",
    pitfall:
      "The negative gradient arrow lies in the parameter xy plane. Its displayed length is 0.4 times the gradient. The purple plane is a local linear approximation, not the surface itself.",
    sourceRefs: ["mit-gradient", "openstax"],
  },
};
export const sources = [
  {
    id: "mit-linear",
    label: "MIT OCW · Linear Algebra",
    url: "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/",
    use: "Basis transformations, determinants, projection, eigenvectors.",
  },
  {
    id: "mit-gradient",
    label: "MIT OCW · Multivariable Calculus",
    url: "https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/",
    use: "Gradients, directional derivatives, and tangent planes.",
  },
  {
    id: "openstax",
    label: "OpenStax · Calculus Volume 1",
    url: "https://openstax.org/details/books/calculus-volume-1",
    use: "Derivatives, numerical integration, and the fundamental theorem.",
  },
  {
    id: "three",
    label: "Three.js documentation",
    url: "https://threejs.org/docs/",
    use: "Renderer, matrices, and right-handed coordinate conventions.",
  },
];
export const applicationCards = [
  {
    id: "robot",
    category: "ENGINEERING",
    title: "A different point of view",
    description:
      "Turn a satellite camera. Discover why the order of two rotations changes where it looks.",
    subject: "Linear algebra",
    difficulty: "Foundations",
    icon: "Orbit" as const,
    tag: "Coordinate frames",
  },
  {
    id: "business",
    category: "BUSINESS",
    title: "Find the sweet spot",
    description:
      "Balance production and demand. Turn a curve into a better daily decision.",
    subject: "Calculus",
    difficulty: "Foundations",
    icon: "Activity" as const,
    tag: "Marginal change",
  },
  {
    id: "regression",
    category: "DATA SCIENCE",
    title: "Let the data draw the line",
    description:
      "Fit a model to synthetic observations. See what the residuals are telling you.",
    subject: "Linear algebra",
    difficulty: "Advanced",
    icon: "SlidersHorizontal" as const,
    tag: "Least squares",
  },
];
