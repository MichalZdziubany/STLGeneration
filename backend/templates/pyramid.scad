// Square Pyramid (base 20 × 20, height 20)
polyhedron(
    points=[
        [-10, -10, 0],   // base
        [10, -10, 0],
        [10, 10, 0],
        [-10, 10, 0],
        [0, 0, 20]       // apex
    ],
    faces=[
        [0,1,2,3],   // bottom
        [0,1,4],     // sides
        [1,2,4],
        [2,3,4],
        [3,0,4]
    ]
);