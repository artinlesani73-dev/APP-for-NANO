import React, { useState, useRef, useEffect } from 'react';
import { SessionGeneration } from '../types';
import { FileText, Settings, Image as ImageIcon } from 'lucide-react';

interface GraphViewProps {
  generation: SessionGeneration;
  theme: 'dark' | 'light';
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
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
  toHandle?: 'prompt' | 'control' | 'reference';
  color: string;
}

const GraphView: React.FC<GraphViewProps> = ({ generation, theme, loadImage }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(0.8);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    generateGraphLayout();
  }, [generation]);

  const generateGraphLayout = () => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const nodeWidth = 220;
    const nodeHeight = 160;
    const imageNodeHeight = 220;
    const workflowNodeHeight = 280;
    const columnSpacing = 300;
    const rowSpacing = 250;

    let currentX = 100;
    const centerY = 300;

    // Column 0: Prompt Node
    newNodes.push({
      id: 'prompt',
      type: 'prompt',
      label: 'Prompt',
      x: currentX,
      y: centerY,
      width: nodeWidth,
      height: nodeHeight,
      data: { text: generation.prompt }
    });

    currentX += columnSpacing;

    // Column 1: Control and Reference Images
    const totalImages = (generation.control_images?.length || 0) + (generation.reference_images?.length || 0);
    const imageColumnStartY = centerY - ((totalImages - 1) * rowSpacing) / 2;

    let currentImageY = imageColumnStartY;

    // Control Images
    if (generation.control_images && generation.control_images.length > 0) {
      generation.control_images.forEach((img, idx) => {
        const nodeId = `control-${idx}`;
        const imageData = loadImage('control', img.id, img.filename);

        newNodes.push({
          id: nodeId,
          type: 'control-image',
          label: `Control ${idx + 1}`,
          x: currentX,
          y: currentImageY,
          width: nodeWidth,
          height: imageNodeHeight,
          data: { image: img, imageData }
        });

        currentImageY += rowSpacing;
      });
    }

    // Reference Images
    if (generation.reference_images && generation.reference_images.length > 0) {
      generation.reference_images.forEach((img, idx) => {
        const nodeId = `reference-${idx}`;
        const imageData = loadImage('reference', img.id, img.filename);

        newNodes.push({
          id: nodeId,
          type: 'reference-image',
          label: `Reference ${idx + 1}`,
          x: currentX,
          y: currentImageY,
          width: nodeWidth,
          height: imageNodeHeight,
          data: { image: img, imageData }
        });

        currentImageY += rowSpacing;
      });
    }

    currentX += columnSpacing;

    // Column 2: Workflow/Parameters Node (centered)
    const workflowY = centerY - workflowNodeHeight / 2 + nodeHeight / 2;
    newNodes.push({
      id: 'workflow',
      type: 'workflow',
      label: 'Workflow',
      x: currentX,
      y: workflowY,
      width: nodeWidth,
      height: workflowNodeHeight,
      data: { parameters: generation.parameters }
    });

    // Connect prompt to workflow prompt handle
    newEdges.push({
      from: 'prompt',
      to: 'workflow',
      toHandle: 'prompt',
      color: '#8b5cf6' // purple
    });

    // Connect control images to workflow control handle
    if (generation.control_images && generation.control_images.length > 0) {
      generation.control_images.forEach((_, idx) => {
        newEdges.push({
          from: `control-${idx}`,
          to: 'workflow',
          toHandle: 'control',
          color: '#10b981' // green
        });
      });
    }

    // Connect reference images to workflow reference handle
    if (generation.reference_images && generation.reference_images.length > 0) {
      generation.reference_images.forEach((_, idx) => {
        newEdges.push({
          from: `reference-${idx}`,
          to: 'workflow',
          toHandle: 'reference',
          color: '#3b82f6' // blue
        });
      });
    }

    currentX += columnSpacing;

    // Column 3: Output Image
    if (generation.output_image) {
      const outputY = centerY - imageNodeHeight / 2 + nodeHeight / 2;
      const imageData = loadImage('output', generation.output_image.id, generation.output_image.filename);

      newNodes.push({
        id: 'output',
        type: 'output-image',
        label: 'Output',
        x: currentX,
        y: outputY,
        width: nodeWidth,
        height: imageNodeHeight,
        data: { image: generation.output_image, imageData }
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

  const getHandlePosition = (node: Node, handle?: 'prompt' | 'control' | 'reference') => {
    if (node.type === 'workflow' && handle) {
      const handleSpacing = node.height / 4;
      const handleYOffsets = {
        prompt: handleSpacing,
        control: handleSpacing * 2,
        reference: handleSpacing * 3
      };
      return {
        x: node.x,
        y: node.y + handleYOffsets[handle]
      };
    }
    return {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2
    };
  };

  const generateCurvePath = (from: Node, to: Node, toHandle?: 'prompt' | 'control' | 'reference') => {
    const fromX = from.x + from.width;
    const fromY = from.y + from.height / 2;

    const toPos = getHandlePosition(to, toHandle);
    const toX = toPos.x;
    const toY = toPos.y;

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
    if (e.button === 0) {
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
    const isDark = theme === 'dark';

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
        {/* Node background */}
        <rect
          width={node.width}
          height={node.height}
          rx={8}
          className={isDark ? 'fill-gray-800 stroke-gray-600' : 'fill-white stroke-gray-300'}
          strokeWidth={2}
        />

        {/* Node header */}
        <rect
          width={node.width}
          height={40}
          rx={8}
          className={`${
            node.type === 'prompt' ? (isDark ? 'fill-purple-600' : 'fill-purple-500') :
            node.type === 'workflow' ? (isDark ? 'fill-blue-600' : 'fill-blue-500') :
            node.type === 'control-image' ? (isDark ? 'fill-green-600' : 'fill-green-500') :
            node.type === 'reference-image' ? (isDark ? 'fill-blue-500' : 'fill-blue-400') :
            isDark ? 'fill-amber-600' : 'fill-amber-500'
          }`}
        />

        {/* Node icon and title */}
        <g transform="translate(10, 10)">
          <foreignObject width={node.width - 20} height={20}>
            <div className="flex items-center gap-2 text-white">
              {node.type === 'prompt' && <FileText size={16} />}
              {node.type === 'workflow' && <Settings size={16} />}
              {node.type.includes('image') && <ImageIcon size={16} />}
              <span className="text-sm font-semibold">{node.label}</span>
            </div>
          </foreignObject>
        </g>

        {/* Node content */}
        <foreignObject x={10} y={50} width={node.width - 20} height={node.height - 60}>
          <div className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs overflow-hidden h-full`}>
            {node.type === 'prompt' && (
              <p className="line-clamp-6 p-2 leading-relaxed">{node.data.text}</p>
            )}
            {node.type === 'workflow' && (
              <div className="p-2 space-y-2">
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Model:</span>
                  <span className="font-medium">{node.data.parameters.model.includes('flash') ? 'Flash' : 'Pro'}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Temperature:</span>
                  <span className="font-medium">{node.data.parameters.temperature}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Top-p:</span>
                  <span className="font-medium">{node.data.parameters.top_p}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Aspect Ratio:</span>
                  <span className="font-medium">{node.data.parameters.aspect_ratio}</span>
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Image Size:</span>
                  <span className="font-medium">{node.data.parameters.image_size}</span>
                </div>
                <div className={`flex justify-between py-1`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Safety:</span>
                  <span className="font-medium">{node.data.parameters.safety_filter}</span>
                </div>
              </div>
            )}
            {isImage && (
              <div className="h-full flex flex-col">
                {node.data.imageData ? (
                  <img
                    src={node.data.imageData}
                    alt={node.label}
                    className="w-full h-36 object-cover rounded"
                  />
                ) : (
                  <div className={`w-full h-36 flex items-center justify-center rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <ImageIcon className={isDark ? 'text-gray-500' : 'text-gray-400'} size={32} />
                  </div>
                )}
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'} truncate`}>
                  {node.data.image.filename}
                </p>
              </div>
            )}
          </div>
        </foreignObject>

        {/* Workflow node handles */}
        {node.type === 'workflow' && (
          <>
            {/* Prompt handle */}
            <circle
              cx={0}
              cy={node.height / 4}
              r={6}
              className="fill-purple-500 stroke-purple-300"
              strokeWidth={2}
            />
            <text
              x={-35}
              y={node.height / 4 + 4}
              className={`text-xs ${isDark ? 'fill-purple-400' : 'fill-purple-600'}`}
              style={{ fontSize: '10px' }}
            >
              Prompt
            </text>

            {/* Control handle */}
            <circle
              cx={0}
              cy={(node.height / 4) * 2}
              r={6}
              className="fill-green-500 stroke-green-300"
              strokeWidth={2}
            />
            <text
              x={-35}
              y={(node.height / 4) * 2 + 4}
              className={`text-xs ${isDark ? 'fill-green-400' : 'fill-green-600'}`}
              style={{ fontSize: '10px' }}
            >
              Control
            </text>

            {/* Reference handle */}
            <circle
              cx={0}
              cy={(node.height / 4) * 3}
              r={6}
              className="fill-blue-500 stroke-blue-300"
              strokeWidth={2}
            />
            <text
              x={-42}
              y={(node.height / 4) * 3 + 4}
              className={`text-xs ${isDark ? 'fill-blue-400' : 'fill-blue-600'}`}
              style={{ fontSize: '10px' }}
            >
              Reference
            </text>

            {/* Output handle */}
            <circle
              cx={node.width}
              cy={node.height / 2}
              r={6}
              className="fill-amber-500 stroke-amber-300"
              strokeWidth={2}
            />
          </>
        )}

        {/* Standard connection points for other nodes */}
        {node.type !== 'workflow' && (
          <>
            <circle
              cx={node.width}
              cy={node.height / 2}
              r={4}
              className={isDark ? 'fill-gray-400' : 'fill-gray-500'}
            />
            <circle
              cx={0}
              cy={node.height / 2}
              r={4}
              className={isDark ? 'fill-gray-400' : 'fill-gray-500'}
            />
          </>
        )}
      </g>
    );
  };

  const renderEdge = (edge: Edge) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return null;

    const path = generateCurvePath(fromNode, toNode, edge.toHandle);

    return (
      <g key={`${edge.from}-${edge.to}-${edge.toHandle || 'default'}`}>
        <path
          d={path}
          stroke={edge.color}
          strokeWidth={2.5}
          fill="none"
          opacity={0.7}
          strokeLinecap="round"
        />
      </g>
    );
  };

  const isDark = theme === 'dark';

  return (
    <div className={`w-full h-full rounded-lg overflow-hidden relative ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Controls */}
      <div className={`absolute top-4 right-4 z-10 rounded-lg p-2 space-y-2 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
        <button
          onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          className={`block w-full px-3 py-1 rounded text-sm transition-colors ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
          }`}
        >
          Zoom +
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 0.1, 0.3))}
          className={`block w-full px-3 py-1 rounded text-sm transition-colors ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
          }`}
        >
          Zoom -
        </button>
        <button
          onClick={() => { setZoom(0.8); setPan({ x: 50, y: 50 }); }}
          className={`block w-full px-3 py-1 rounded text-sm transition-colors ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
          }`}
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
      <div className={`absolute bottom-4 left-4 rounded-lg p-3 space-y-1 text-xs ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
        <div className="font-semibold mb-2">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-purple-600 rounded"></div>
          <span>Prompt Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-green-600 rounded"></div>
          <span>Control Images</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-blue-500 rounded"></div>
          <span>Reference Images</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-amber-600 rounded"></div>
          <span>Output</span>
        </div>
      </div>
    </div>
  );
};

export default GraphView;
