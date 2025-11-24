import React, { useState, useRef, useEffect } from 'react';
import { SessionGeneration } from '../types';
import { FileText, Settings, Image as ImageIcon, Sparkles } from 'lucide-react';

interface GraphViewProps {
  generation: SessionGeneration;
}

interface Node {
  id: string;
  type: 'prompt' | 'workflow' | 'control-image' | 'reference-image' | 'output-image';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: any;
}

interface Edge {
  from: string;
  to: string;
  color: string;
}

const GraphView: React.FC<GraphViewProps> = ({ generation }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    generateGraphLayout();
  }, [generation]);

  const generateGraphLayout = () => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const nodeWidth = 200;
    const nodeHeight = 150;
    const imageNodeHeight = 200;
    const columnSpacing = 280;
    const rowSpacing = 240;

    let currentX = 100;
    let currentY = 100;

    // Column 0: Prompt Node
    newNodes.push({
      id: 'prompt',
      type: 'prompt',
      label: 'Prompt',
      x: currentX,
      y: currentY,
      width: nodeWidth,
      height: nodeHeight,
      data: { text: generation.prompt }
    });

    currentX += columnSpacing;

    // Column 1: Control Images (if any)
    let controlY = currentY;
    if (generation.control_images && generation.control_images.length > 0) {
      generation.control_images.forEach((img, idx) => {
        const nodeId = `control-${idx}`;
        newNodes.push({
          id: nodeId,
          type: 'control-image',
          label: `Control Image ${idx + 1}`,
          x: currentX,
          y: controlY,
          width: nodeWidth,
          height: imageNodeHeight,
          data: { image: img }
        });

        newEdges.push({
          from: 'prompt',
          to: nodeId,
          color: '#10b981' // green
        });

        controlY += imageNodeHeight + 40;
      });
    }

    // Column 1: Reference Images (below control images)
    let referenceY = controlY + 20;
    if (generation.reference_images && generation.reference_images.length > 0) {
      generation.reference_images.forEach((img, idx) => {
        const nodeId = `reference-${idx}`;
        newNodes.push({
          id: nodeId,
          type: 'reference-image',
          label: `Reference Image ${idx + 1}`,
          x: currentX,
          y: referenceY,
          width: nodeWidth,
          height: imageNodeHeight,
          data: { image: img }
        });

        newEdges.push({
          from: 'prompt',
          to: nodeId,
          color: '#3b82f6' // blue
        });

        referenceY += imageNodeHeight + 40;
      });
    }

    currentX += columnSpacing;

    // Column 2: Workflow/Parameters Node
    const workflowY = currentY + 100;
    newNodes.push({
      id: 'workflow',
      type: 'workflow',
      label: 'Workflow',
      x: currentX,
      y: workflowY,
      width: nodeWidth,
      height: nodeHeight + 50,
      data: { parameters: generation.parameters }
    });

    // Connect all images to workflow
    newEdges.push({
      from: 'prompt',
      to: 'workflow',
      color: '#8b5cf6' // purple
    });

    if (generation.control_images && generation.control_images.length > 0) {
      generation.control_images.forEach((_, idx) => {
        newEdges.push({
          from: `control-${idx}`,
          to: 'workflow',
          color: '#10b981'
        });
      });
    }

    if (generation.reference_images && generation.reference_images.length > 0) {
      generation.reference_images.forEach((_, idx) => {
        newEdges.push({
          from: `reference-${idx}`,
          to: 'workflow',
          color: '#3b82f6'
        });
      });
    }

    currentX += columnSpacing;

    // Column 3: Output Image
    if (generation.output_image) {
      const outputY = workflowY;
      newNodes.push({
        id: 'output',
        type: 'output-image',
        label: 'Output',
        x: currentX,
        y: outputY,
        width: nodeWidth,
        height: imageNodeHeight,
        data: { image: generation.output_image }
      });

      newEdges.push({
        from: 'workflow',
        to: 'output',
        color: '#f59e0b' // amber
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const getNodeCenter = (node: Node) => ({
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  });

  const generateCurvePath = (from: Node, to: Node) => {
    const fromCenter = getNodeCenter(from);
    const toCenter = getNodeCenter(to);

    const fromX = from.x + from.width;
    const fromY = fromCenter.y;
    const toX = to.x;
    const toY = toCenter.y;

    const midX = (fromX + toX) / 2;

    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newZoom = Math.min(Math.max(0.3, zoom + delta), 2);
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const renderNode = (node: Node) => {
    const isImage = node.type.includes('image');

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
        {/* Node background */}
        <rect
          width={node.width}
          height={node.height}
          rx={8}
          className="fill-gray-800 stroke-gray-600"
          strokeWidth={2}
        />

        {/* Node header */}
        <rect
          width={node.width}
          height={36}
          rx={8}
          className={`${
            node.type === 'prompt' ? 'fill-purple-600' :
            node.type === 'workflow' ? 'fill-blue-600' :
            node.type === 'control-image' ? 'fill-green-600' :
            node.type === 'reference-image' ? 'fill-blue-500' :
            'fill-amber-600'
          }`}
        />

        {/* Node icon */}
        <g transform="translate(8, 8)">
          {node.type === 'prompt' && <FileText size={20} className="text-white" />}
          {node.type === 'workflow' && <Settings size={20} className="text-white" />}
          {node.type.includes('image') && <ImageIcon size={20} className="text-white" />}
        </g>

        {/* Node title */}
        <text
          x={36}
          y={24}
          className="fill-white text-sm font-semibold"
          style={{ fontSize: '14px' }}
        >
          {node.label}
        </text>

        {/* Node content */}
        <foreignObject x={8} y={44} width={node.width - 16} height={node.height - 52}>
          <div className="text-gray-300 text-xs overflow-hidden">
            {node.type === 'prompt' && (
              <p className="line-clamp-4 p-2">{node.data.text}</p>
            )}
            {node.type === 'workflow' && (
              <div className="p-2 space-y-1">
                <div><span className="text-gray-400">Model:</span> {node.data.parameters.model}</div>
                <div><span className="text-gray-400">Temp:</span> {node.data.parameters.temperature}</div>
                <div><span className="text-gray-400">Top-p:</span> {node.data.parameters.top_p}</div>
                <div><span className="text-gray-400">Ratio:</span> {node.data.parameters.aspect_ratio}</div>
                <div><span className="text-gray-400">Size:</span> {node.data.parameters.image_size}</div>
                <div><span className="text-gray-400">Safety:</span> {node.data.parameters.safety_filter}</div>
              </div>
            )}
            {isImage && (
              <div className="p-2">
                <div className="bg-gray-700 rounded p-2 text-center">
                  <ImageIcon className="mx-auto mb-1" size={32} />
                  <p className="text-xs">{node.data.image.filename}</p>
                </div>
              </div>
            )}
          </div>
        </foreignObject>

        {/* Connection points */}
        <circle cx={node.width} cy={node.height / 2} r={4} className="fill-gray-400" />
        <circle cx={0} cy={node.height / 2} r={4} className="fill-gray-400" />
      </g>
    );
  };

  const renderEdge = (edge: Edge) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return null;

    const path = generateCurvePath(fromNode, toNode);

    return (
      <g key={`${edge.from}-${edge.to}`}>
        <path
          d={path}
          stroke={edge.color}
          strokeWidth={2}
          fill="none"
          opacity={0.6}
        />
      </g>
    );
  };

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 bg-gray-800 rounded-lg p-2 space-y-2">
        <button
          onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          className="block w-full px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          Zoom In
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 0.1, 0.3))}
          className="block w-full px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          Zoom Out
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="block w-full px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          Reset
        </button>
      </div>

      {/* Graph canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render edges first (behind nodes) */}
          {edges.map(renderEdge)}

          {/* Render nodes */}
          {nodes.map(renderNode)}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-800 rounded-lg p-3 space-y-1 text-xs">
        <div className="font-semibold mb-2">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-purple-600"></div>
          <span>Prompt Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-green-600"></div>
          <span>Control Images</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-blue-500"></div>
          <span>Reference Images</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-amber-600"></div>
          <span>Output</span>
        </div>
      </div>
    </div>
  );
};

export default GraphView;
