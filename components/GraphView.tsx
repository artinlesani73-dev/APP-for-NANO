import React, { useState, useRef, useEffect } from 'react';
import { Session, SessionGeneration } from '../types';
import { FileText, Settings, Image as ImageIcon, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface GraphViewProps {
  session: Session;
  theme: 'dark' | 'light';
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
}

interface Node {
  id: string;
  generationId: string;
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

const GraphView: React.FC<GraphViewProps> = ({ session, theme, loadImage }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(0.7);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    generateGraphLayout();
  }, [session]);

  const generateGraphLayout = () => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const nodeWidth = 220;
    const nodeHeight = 160;
    const imageNodeHeight = 220;
    const workflowNodeHeight = 280;
    const generationSpacingX = 1200; // Horizontal spacing between generations
    const generationSpacingY = 800; // Vertical spacing between generations
    const columnSpacing = 300;

    let currentGenX = 100;
    let currentGenY = 100;
    let generationsPerRow = 2; // Layout generations in a grid

    session.generations.forEach((generation, genIndex) => {
      // Calculate grid position for this generation
      const row = Math.floor(genIndex / generationsPerRow);
      const col = genIndex % generationsPerRow;
      const baseX = col * generationSpacingX + 100;
      const baseY = row * generationSpacingY + 100;

      let currentX = baseX;
      const centerY = baseY + 300;

      // Column 0: Prompt Node
      const promptNodeId = `gen${genIndex}-prompt`;
      newNodes.push({
        id: promptNodeId,
        generationId: generation.generation_id,
        type: 'prompt',
        label: `Prompt #${genIndex + 1}`,
        x: currentX,
        y: centerY,
        width: nodeWidth,
        height: nodeHeight,
        data: { text: generation.prompt, status: generation.status }
      });

      currentX += columnSpacing;

      // Column 1: Control and Reference Images
      const totalImages = (generation.control_images?.length || 0) + (generation.reference_images?.length || 0);
      const imageColumnStartY = centerY - ((totalImages - 1) * 250) / 2;

      let currentImageY = imageColumnStartY;

      // Control Images
      if (generation.control_images && generation.control_images.length > 0) {
        generation.control_images.forEach((img, idx) => {
          const nodeId = `gen${genIndex}-control-${idx}`;
          const imageData = loadImage('control', img.id, img.filename);

          newNodes.push({
            id: nodeId,
            generationId: generation.generation_id,
            type: 'control-image',
            label: `Control ${idx + 1}`,
            x: currentX,
            y: currentImageY,
            width: nodeWidth,
            height: imageNodeHeight,
            data: { image: img, imageData }
          });

          currentImageY += 250;
        });
      }

      // Reference Images
      if (generation.reference_images && generation.reference_images.length > 0) {
        generation.reference_images.forEach((img, idx) => {
          const nodeId = `gen${genIndex}-reference-${idx}`;
          const imageData = loadImage('reference', img.id, img.filename);

          newNodes.push({
            id: nodeId,
            generationId: generation.generation_id,
            type: 'reference-image',
            label: `Reference ${idx + 1}`,
            x: currentX,
            y: currentImageY,
            width: nodeWidth,
            height: imageNodeHeight,
            data: { image: img, imageData }
          });

          currentImageY += 250;
        });
      }

      currentX += columnSpacing;

      // Column 2: Workflow/Parameters Node
      const workflowNodeId = `gen${genIndex}-workflow`;
      const workflowY = centerY - workflowNodeHeight / 2 + nodeHeight / 2;
      newNodes.push({
        id: workflowNodeId,
        generationId: generation.generation_id,
        type: 'workflow',
        label: `Workflow #${genIndex + 1}`,
        x: currentX,
        y: workflowY,
        width: nodeWidth,
        height: workflowNodeHeight,
        data: { parameters: generation.parameters }
      });

      // Connect prompt to workflow
      newEdges.push({
        from: promptNodeId,
        to: workflowNodeId,
        toHandle: 'prompt',
        color: '#8b5cf6' // purple
      });

      // Connect control images to workflow
      if (generation.control_images && generation.control_images.length > 0) {
        generation.control_images.forEach((_, idx) => {
          newEdges.push({
            from: `gen${genIndex}-control-${idx}`,
            to: workflowNodeId,
            toHandle: 'control',
            color: '#10b981' // green
          });
        });
      }

      // Connect reference images to workflow
      if (generation.reference_images && generation.reference_images.length > 0) {
        generation.reference_images.forEach((_, idx) => {
          newEdges.push({
            from: `gen${genIndex}-reference-${idx}`,
            to: workflowNodeId,
            toHandle: 'reference',
            color: '#3b82f6' // blue
          });
        });
      }

      currentX += columnSpacing;

      // Column 3: Output Image
      if (generation.output_image) {
        const outputNodeId = `gen${genIndex}-output`;
        const outputY = centerY - imageNodeHeight / 2 + nodeHeight / 2;
        const imageData = loadImage('output', generation.output_image.id, generation.output_image.filename);

        newNodes.push({
          id: outputNodeId,
          generationId: generation.generation_id,
          type: 'output-image',
          label: `Output #${genIndex + 1}`,
          x: currentX,
          y: outputY,
          width: nodeWidth,
          height: imageNodeHeight,
          data: { image: generation.output_image, imageData }
        });

        newEdges.push({
          from: workflowNodeId,
          to: outputNodeId,
          color: '#f59e0b' // amber
        });
      }
    });

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
    const newZoom = Math.min(Math.max(0.2, zoom + delta), 2);
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId?: string) => {
    if (nodeId) {
      // Start dragging a node
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setDraggingNode(nodeId);
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const svgX = (e.clientX - rect.left - pan.x) / zoom;
          const svgY = (e.clientY - rect.top - pan.y) / zoom;
          setDragOffset({
            x: svgX - node.x,
            y: svgY - node.y
          });
        }
      }
    } else if (e.button === 0) {
      // Start panning the canvas
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      // Drag the node
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const svgX = (e.clientX - rect.left - pan.x) / zoom;
        const svgY = (e.clientY - rect.top - pan.y) / zoom;

        setNodes(prevNodes =>
          prevNodes.map(node =>
            node.id === draggingNode
              ? { ...node, x: svgX - dragOffset.x, y: svgY - dragOffset.y }
              : node
          )
        );
      }
    } else if (isPanning) {
      // Pan the canvas
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
  };

  const renderNode = (node: Node) => {
    const isImage = node.type.includes('image');
    const isDark = theme === 'dark';

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleMouseDown(e, node.id);
        }}
        style={{ cursor: 'move' }}
      >
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
              {node.type === 'prompt' && node.data.status && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  node.data.status === 'completed' ? 'bg-green-500/30' :
                  node.data.status === 'failed' ? 'bg-red-500/30' :
                  'bg-yellow-500/30'
                }`}>
                  {node.data.status}
                </span>
              )}
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
                  {node.data.image?.filename || 'No image'}
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
    <div
      ref={containerRef}
      className={`w-full h-full relative ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      {/* Controls */}
      <div className={`absolute top-4 right-4 z-10 rounded-lg p-2 space-y-2 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
        <button
          onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          className={`block w-full px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
          }`}
        >
          <ZoomIn size={16} />
          Zoom In
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 0.1, 0.2))}
          className={`block w-full px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
          }`}
        >
          <ZoomOut size={16} />
          Zoom Out
        </button>
        <button
          onClick={() => { setZoom(0.7); setPan({ x: 50, y: 50 }); }}
          className={`block w-full px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
          }`}
        >
          <Maximize2 size={16} />
          Reset View
        </button>
      </div>

      {/* Graph canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
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
        <div className="font-semibold mb-2">Session: {session.title}</div>
        <div className="text-xs text-gray-500 mb-2">{session.generations.length} generation(s)</div>
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
        <div className="mt-2 pt-2 border-t border-gray-600 text-gray-500">
          <div>💡 Drag nodes to reposition</div>
          <div>🖱️ Drag canvas to pan</div>
          <div>🔍 Scroll to zoom</div>
        </div>
      </div>
    </div>
  );
};

export default GraphView;
