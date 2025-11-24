//
// PYRAMID TEMPLATE
// Square pyramid using polyhedron.
// Parameters injected by backend.
//

base_size = {{BASE_SIZE}};   // width & depth
height    = {{HEIGHT}};      // height
centered  = {{CENTERED}};    // bool

// Offset for centering logic
offset_z = centered ? -height/2 : 0;

polyhedron(
    points=[
        [-base_size/2, -base_size/2, offset_z],
        [ base_size/2, -base_size/2, offset_z],
        [ base_size/2,  base_size/2, offset_z],
        [-base_size/2,  base_size/2, offset_z],
        [0, 0, height + offset_z]   // apex
    ],
    faces=[
        [0,1,2,3],   // bottom
        [0,1,4],     // sides
        [1,2,4],
        [2,3,4],
        [3,0,4]
    ]
);
