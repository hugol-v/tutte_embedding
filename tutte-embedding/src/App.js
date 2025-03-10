import React, { useState, useEffect, useRef } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import * as d3 from 'd3';

// Add the planarity checking function as a utility outside the component
const checkPlanarity = (nodes, edges) => {
  const doIntersect = (p1, q1, p2, q2) => {
    const orientation = (p, q, r) => {
      const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
      if (Math.abs(val) < 1e-10) return 0; // Collinear
      return val > 0 ? 1 : 2;
    };

    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    // General case
    if (o1 !== o2 && o3 !== o4) {
      console.log("Intersection found!");
      return true;
    }

    return false;
  };

  // Check all pairs of edges for intersection
  let isPlanar = true;
  
  for (let i = 0; i < edges.length; i++) {
    const edge1 = edges[i];
    const p1 = nodes.find(n => n.id === edge1.from);
    const q1 = nodes.find(n => n.id === edge1.to);
    
    for (let j = i + 1; j < edges.length; j++) {
      const edge2 = edges[j];
      const p2 = nodes.find(n => n.id === edge2.from);
      const q2 = nodes.find(n => n.id === edge2.to);
      
      // Skip if edges share an endpoint
      if (edge1.from === edge2.from || edge1.from === edge2.to || 
          edge1.to === edge2.from || edge1.to === edge2.to) {
        continue;
      }
      
      if (doIntersect(
        { x: p1.x, y: p1.y }, 
        { x: q1.x, y: q1.y },
        { x: p2.x, y: p2.y }, 
        { x: q2.x, y: q2.y }
      )) {
        isPlanar = false;
        break;
      }
    }
    if (!isPlanar) break;
  }
  
  return isPlanar;
};

const App = () => {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [numNodes, setNumNodes] = useState(15);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hullNodes, setHullNodes] = useState([]); // State to save the convex hull nodes
  const networkRef = useRef(null);
  const intervalRef = useRef(null);
  const networkInstance = useRef(null);
  const frameCountRef = useRef(0);

  const identifyOuterVertices = () => {
    setGraphData(prevData => {
      const updatedNodes = prevData.nodes.map(node => {
        if (hullNodes.includes(node.id)) {
          return { ...node, color: 'black' };
        }
        else {
          return { ...node, color: 'skyblue' };
        }
      });
      return { ...prevData, nodes: updatedNodes };
    });
  };

  const generateRandomGraph = () => {
    const radius = 500;
    const edgeColor = '#5A5A5A';
    const nodes = Array.from({ length: numNodes }, (_, i) => {
      const x = Math.random() * radius * 2 - radius;
      const y = Math.random() * radius * 2 - radius;
      return {
        id: i,
        x,
        y,
        color: 'skyblue',
      };
    });
  
    // Generate edges using Delaunay triangulation
    const points = nodes.map(node => [node.x, node.y]);
    const delaunay = d3.Delaunay.from(points);
  
    const edges = [];
  
    for (let i = 0; i < delaunay.triangles.length; i += 3) {
      const a = delaunay.triangles[i];
      const b = delaunay.triangles[i + 1];
      const c = delaunay.triangles[i + 2];
      edges.push({ from: a, to: b , color: edgeColor});
      edges.push({ from: b, to: c , color: edgeColor});
      edges.push({ from: c, to: a, color: edgeColor});
    }
  
    // Identify the convex hull nodes and set them as fixed
    const hull = delaunay.hull;
    hull.forEach(index => {
      nodes[index].fixed = false;
      nodes[index].color = 'skyblue'; // Set initial color to skyblue
    });
  
    // Place each node randomly uniformly in the square
    nodes.forEach(node => {
      node.x = Math.random() * radius * 2 - radius;
      node.y = Math.random() * radius * 2 - radius;
    });
  
    setGraphData({ nodes, edges });
    setHullNodes(hull); // Save the convex hull nodes
  };

  const updateGraph = () => {
    if (!networkInstance.current) return;

    const nodes = [...graphData.nodes];
    let maxMovement = 0;

    nodes.forEach(node => {
      // If the color is black, it means it's a convex hull node and should be fixed
      if (node.color === 'black') return;

      const neighbors = graphData.edges
        .filter(edge => edge.from === node.id || edge.to === node.id)
        .map(edge => (edge.from === node.id ? edge.to : edge.from));

      const target = neighbors.reduce(
        (acc, neighborId) => {
          const neighbor = nodes.find(n => n.id === neighborId);
          acc.x += neighbor.x;
          acc.y += neighbor.y;
          return acc;
        },
        { x: 0, y: 0 }
      );

      target.x /= neighbors.length;
      target.y /= neighbors.length;

      const force = { x: target.x - node.x, y: target.y - node.y };
      node.vx = (node.vx || 0) * 0.8 + force.x * 0.2;
      node.vy = (node.vy || 0) * 0.8 + force.y * 0.2;

      node.x += node.vx;
      node.y += node.vy;

      maxMovement = Math.max(maxMovement, Math.sqrt(node.vx ** 2 + node.vy ** 2));
    });

    // Check for planarity every 10 frames or when movement is small
    //if (frameCountRef.current % 10 === 0 || maxMovement < 0.01) {
      if (true) {
      const isPlanar = checkPlanarity(nodes, graphData.edges);
      
      // Update non-black nodes color based on planarity
      nodes.forEach(node => {
        if (node.color !== 'black') {
          node.color = isPlanar ? 'pink' : 'skyblue';
        }
      });
    }

    setGraphData({ ...graphData, nodes });

    if (maxMovement < 1e-3) {
      clearInterval(intervalRef.current);
      setIsAnimating(false);
    }
  };

  const startAnimation = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsAnimating(true);
    frameCountRef.current = 0;
    intervalRef.current = setInterval(() => {
      frameCountRef.current += 1;
      updateGraph();
    }, 50);
  };

  const startAnimationFromCurrentPositions = () => {
    // Get current node positions from vis-network
    const updatedPositions = networkInstance.current.getPositions();
    const newNodes = graphData.nodes.map(node => {
      const { x, y } = updatedPositions[node.id];
      return { ...node, x, y };
    });

    setGraphData({ ...graphData, nodes: newNodes });
    startAnimation();
  };

  const stopAnimation = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsAnimating(false);
  };

  const toggleAnimation = () => {
    if (isAnimating) {
      stopAnimation();
    } else {
      startAnimationFromCurrentPositions();
    }
  };

  useEffect(() => {
    if (networkRef.current && graphData.nodes.length > 0) {
      const data = {
        nodes: graphData.nodes.map(node => ({
          id: node.id,
          x: node.x,
          y: node.y,
          color: node.color,
          fixed: node.fixed,
        })),
        edges: graphData.edges,
      };
  
      const options = {
        nodes: {
          shape: 'dot',
          size: 15,
        },
        edges: {
          smooth: false,
        },
        physics: {
          enabled: false,
        },
        interaction: {
          dragNodes: true,
        },
      };
  
      if (!networkInstance.current) {
        networkInstance.current = new Network(networkRef.current, data, options);
        
        // Add event listener for node dragging
        networkInstance.current.on("dragEnd", function(params) {
          if (params.nodes && params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const position = networkInstance.current.getPositions([nodeId])[nodeId];
            
            setGraphData(prevData => {
              const updatedNodes = prevData.nodes.map(node => {
                if (node.id === nodeId) {
                  return {
                    ...node,
                    x: position.x,
                    y: position.y,
                    fixed: node.fixed,
                  };
                }
                return node;
              });
              
              return {...prevData, nodes: updatedNodes};
            });
          }
        });
  
        // Add event listener for double-clicking on nodes
        networkInstance.current.on("doubleClick", function(params) {
          if (params.nodes && params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            
            setGraphData(prevData => {
              const updatedNodes = prevData.nodes.map(node => {
                if (node.id === nodeId) {
                  return {
                    ...node,
                    color: node.color === 'black' ? 'skyblue' : 'black',
                  };
                }
                return node;
              });
              
              return {...prevData, nodes: updatedNodes};
            });
          }
        });
      } else {
        networkInstance.current.setData(data);
      }
    }
  }, [graphData]);

  return (
    <div style={{ padding: '10px' }}>
      <h1>Tutte Embedding of 3-Connected (Random) Planar Graph</h1>

      <div style={{ display: 'flex', alignItems: 'center'}}>
        <div style={{ marginRight: '10px' }}>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            Number of Nodes:
          </label>
          <input
            type="number"
            value={numNodes}
            onChange={(e) => setNumNodes(parseInt(e.target.value))}
            min="3"
            style={{ marginBottom: '20px' }}
          />
        </div>

        <button
            onClick={generateRandomGraph}
            style={{ padding: '10px', fontSize: '16px', marginRight: '10px' }}>
            Generate Graph
        </button>

        <button
            onClick={identifyOuterVertices}
            style={{ padding: '10px', fontSize: '16px', marginRight: '10px' }}>
            Identify Outer Vertices
        </button>

        <div style={{display: 'flex', justifyContent: 'flex-end', flex: 1}}>
          <button
          onClick={toggleAnimation}
          style={{ padding: '10px', fontSize: '16px' }}>
          {isAnimating ? 'Stop Animation' : 'Start Animation'}
        </button>
      </div>

      </div>


      {/* Graph container */}
      <div
        ref={networkRef}
        style={{ width: '100%', height: '500px', border: '1px solid black' }}
      ></div>
    </div>
  );
};

export default App;