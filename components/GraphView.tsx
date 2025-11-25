import React, { useState, useRef, useEffect } from 'react';
import { Session, SessionGeneration, GenerationConfig } from '../types';
import { FileText, Settings, Image as ImageIcon, ZoomIn, ZoomOut, Maximize2, Play, Plus } from 'lucide-react';

interface GraphViewProps {
  session: Session;
  theme: 'dark' | 'light';
  loadImage: (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;
  onGenerateFromNode?: (prompt: string, config: GenerationConfig, controlImages?: string[], referenceImages?: string[]) => Promise<void>;
}

interface Node {
  id: string;
  generationId?: string; // Optional for standalone nodes
  type: 'prompt' | 'workflow' | 'control-image' | 'reference-image' | 'output-image' | 'output-text';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: any;
  isStandalone?: boolean; // True if created directly in graph view
}

interface Edge {
  from: string;
  to: string;
  toHandle?: 'prompt' | 'control' | 'reference';
  color: string;
}

interface ContextMenu {
  x: number;
  y: number;
  svgX: number;
  svgY: number;
  nodeId?: string;
}

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

const GraphView: React.FC<GraphViewProps> = ({ session, theme, loadImage, onGenerateFromNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [sessionNodes, setSessionNodes] = useState<Node[]>([]);
  const [sessionEdges, setSessionEdges] = useState<Edge[]>([]);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(0.7);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [standaloneNodes, setStandaloneNodes] = useState<Node[]>([]);
  const [standaloneEdges, setStandaloneEdges] = useState<Edge[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handle?: string } | null>(null);
  const [connectionPreview, setConnectionPreview] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);

  useEffect(() => {
    generateGraphLayout();
  }, [session]);

  // Sync standalone edges
  useEffect(() => {
    // Merge edges while preventing accidental duplicates when state updates overlap
    const mergedEdges = [...sessionEdges, ...standaloneEdges];
    const uniqueEdges = mergedEdges.filter((edge, index, arr) =>
      arr.findIndex(e => e.from === edge.from && e.to === edge.to && e.toHandle === edge.toHandle) === index
    );
    setEdges(uniqueEdges);
  }, [standaloneEdges, sessionEdges]);

  // Combine session and standalone nodes for rendering without duplicating existing nodes
  useEffect(() => {
    const mergedNodes = [...sessionNodes, ...standaloneNodes];
    const uniqueNodes = mergedNodes.filter((node, index, arr) =>
      arr.findIndex(n => n.id === node.id) === index
    );
    setNodes(uniqueNodes);
  }, [sessionNodes, standaloneNodes]);

  // Handle wheel events with non-passive listener
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      setZoom(prevZoom => Math.min(Math.max(0.2, prevZoom + delta), 2));
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  const generateGraphLayout = () => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const nodeWidth = 220;
    const nodeHeight = 160;
    const imageNodeHeight = 220;
    const outputImageHeight = 300;
    const workflowNodeHeight = 280;
    const generationSpacingX = 1200; // Horizontal spacing between generations
    const generationSpacingY = 1100; // Vertical spacing between generations
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

      // Column 3: Output Image/Text
      const outputImages = generation.output_images || (generation.output_image ? [generation.output_image] : []);
      const outputTexts = generation.output_texts || [];
      const textsQueue = [...outputTexts];
      const totalOutputs = outputImages.length + outputTexts.length;

      if (totalOutputs > 0) {
        const outputSpacing = 320;
        const outputStartY = centerY - ((totalOutputs - 1) * outputSpacing) / 2;
        let currentOutputY = outputStartY;

        outputImages.forEach((image, idx) => {
          const outputNodeId = `gen${genIndex}-output-${idx}`;
          const imageData = loadImage('output', image.id, image.filename);
          const attachedText = textsQueue.shift();

          newNodes.push({
            id: outputNodeId,
            generationId: generation.generation_id,
            type: 'output-image',
            label: `Output ${idx + 1}`,
            x: currentX,
            y: currentOutputY,
            width: nodeWidth,
            height: outputImageHeight,
            data: { image, imageData, text: attachedText }
          });

          newEdges.push({
            from: workflowNodeId,
            to: outputNodeId,
            color: '#f59e0b' // amber
          });

          currentOutputY += outputSpacing;
        });

        textsQueue.forEach((text, idx) => {
          const textNodeId = `gen${genIndex}-output-text-${idx}`;
          newNodes.push({
            id: textNodeId,
            generationId: generation.generation_id,
            type: 'output-text',
            label: `Text ${idx + 1}`,
            x: currentX,
            y: currentOutputY,
            width: nodeWidth,
            height: nodeHeight,
            data: { text }
          });

          newEdges.push({
            from: workflowNodeId,
            to: textNodeId,
            color: '#f59e0b'
          });

          currentOutputY += outputSpacing;
        });
      }
    });

    setSessionNodes(newNodes);
    setSessionEdges(newEdges);
    setEdges([...newEdges, ...standaloneEdges]);
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

  const handleMouseDown = (e: React.MouseEvent, nodeId?: string) => {
    if (nodeId) {
      // Start dragging a node
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setDraggingNode(nodeId);
        setIsDraggingNode(true);
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

        // Check if it's a standalone node
        const node = standaloneNodes.find(n => n.id === draggingNode);
        if (node) {
          // Update standalone node position
          setStandaloneNodes(prevNodes =>
            prevNodes.map(n =>
              n.id === draggingNode
                ? { ...n, x: svgX - dragOffset.x, y: svgY - dragOffset.y }
                : n
            )
          );
        } else {
          // Update regular node position
          setNodes(prevNodes =>
            prevNodes.map(n =>
              n.id === draggingNode
                ? { ...n, x: svgX - dragOffset.x, y: svgY - dragOffset.y }
                : n
            )
          );
        }
      }
    } else if (connectingFrom) {
      // Update connection preview
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const svgX = (e.clientX - rect.left - pan.x) / zoom;
        const svgY = (e.clientY - rect.top - pan.y) / zoom;
        setConnectionPreview({ x: svgX, y: svgY });
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
    setIsDraggingNode(false);
    setConnectingFrom(null);
    setConnectionPreview(null);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, nodeId?: string) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const svgX = (e.clientX - rect.left - pan.x) / zoom;
      const svgY = (e.clientY - rect.top - pan.y) / zoom;
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        svgX,
        svgY,
        nodeId
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const canDeleteNode = (nodeId: string) => {
    return !edges.some(edge => edge.from === nodeId || edge.to === nodeId);
  };

  const deleteNode = (nodeId: string) => {
    setStandaloneNodes(prev => prev.filter(node => node.id !== nodeId));
    setSessionNodes(prev => prev.filter(node => node.id !== nodeId));
    setStandaloneEdges(prev => prev.filter(edge => edge.from !== nodeId && edge.to !== nodeId));
    setSessionEdges(prev => prev.filter(edge => edge.from !== nodeId && edge.to !== nodeId));
    closeContextMenu();
  };

  // Helper to check if position overlaps with existing nodes
  const findNonOverlappingPosition = (initialX: number, initialY: number, width: number, height: number) => {
    let x = initialX;
    let y = initialY;
    const offset = 30; // Offset to apply if overlap detected

    // Check against all current nodes
    const allNodes = nodes;
    let hasOverlap = true;
    let attempts = 0;
    const maxAttempts = 20;

    while (hasOverlap && attempts < maxAttempts) {
      hasOverlap = allNodes.some(node => {
        return !(
          x + width < node.x ||
          x > node.x + node.width ||
          y + height < node.y ||
          y > node.y + node.height
        );
      });

      if (hasOverlap) {
        x += offset;
        y += offset;
        attempts++;
      }
    }

    return { x, y };
  };

  const addPromptNode = (x: number, y: number) => {
    const width = 220;
    const height = 160;
    const position = findNonOverlappingPosition(x, y, width, height);

    const newNode: Node = {
      id: `standalone-prompt-${Date.now()}`,
      type: 'prompt',
      label: 'New Prompt',
      x: position.x,
      y: position.y,
      width,
      height,
      isStandalone: true,
      data: { text: 'Enter your prompt here...', status: 'pending' }
    };
    setStandaloneNodes([...standaloneNodes, newNode]);
    closeContextMenu();
  };

  const addWorkflowNode = (x: number, y: number) => {
    const width = 220;
    const height = 280;
    const position = findNonOverlappingPosition(x, y, width, height);

    const newNode: Node = {
      id: `standalone-workflow-${Date.now()}`,
      type: 'workflow',
      label: 'New Workflow',
      x: position.x,
      y: position.y,
      width,
      height,
      isStandalone: true,
      data: { parameters: { ...DEFAULT_CONFIG } }
    };
    setStandaloneNodes([...standaloneNodes, newNode]);
    closeContextMenu();
  };

  // Drag and drop handlers for external images
  const handleDragOver = (e: React.DragEvent) => {
    // Only handle external file drags, not internal node drags
    if (!isDraggingNode && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isDraggingNode && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    // Only handle external file drops, not node drags
    if (isDraggingNode || !e.dataTransfer.types.includes('Files')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const svgX = (e.clientX - rect.left - pan.x) / zoom;
    const svgY = (e.clientY - rect.top - pan.y) / zoom;

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const reader = new FileReader();

      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newNode: Node = {
          id: `standalone-control-${Date.now()}-${i}`,
          type: 'control-image',
          label: file.name,
          x: svgX + (i * 250),
          y: svgY,
          width: 220,
          height: 220,
          isStandalone: true,
          data: { image: { filename: file.name }, imageData: base64 }
        };
        setStandaloneNodes(prev => [...prev, newNode]);
      };

      reader.readAsDataURL(file);
    }
  };

  // Generate from workflow node
  const handleGenerateFromWorkflow = async (workflowNodeId: string) => {
    if (!onGenerateFromNode) return;

    const workflowNode = nodes.find(n => n.id === workflowNodeId);
    if (!workflowNode || workflowNode.type !== 'workflow') return;

    // Find connected nodes
    const connectedEdges = edges.filter(e => e.to === workflowNodeId);
    const promptEdge = connectedEdges.find(e => e.toHandle === 'prompt');
    const controlEdges = connectedEdges.filter(e => e.toHandle === 'control');
    const referenceEdges = connectedEdges.filter(e => e.toHandle === 'reference');

    // Get prompt
    const promptNode = promptEdge ? nodes.find(n => n.id === promptEdge.from) : null;
    const prompt = promptNode?.data?.text || 'Default prompt';

    // Get control images
    const controlImages: string[] = [];
    for (const edge of controlEdges) {
      const node = nodes.find(n => n.id === edge.from);
      if (node?.data?.imageData) {
        controlImages.push(node.data.imageData);
      }
    }

    // Get reference images
    const referenceImages: string[] = [];
    for (const edge of referenceEdges) {
      const node = nodes.find(n => n.id === edge.from);
      if (node?.data?.imageData) {
        referenceImages.push(node.data.imageData);
      }
    }

    // Call the generation function
    await onGenerateFromNode(
      prompt,
      workflowNode.data.parameters,
      controlImages.length > 0 ? controlImages : undefined,
      referenceImages.length > 0 ? referenceImages : undefined
    );
  };

  // Update node data (for editing)
  const updateNodeData = (nodeId: string, newData: any) => {
    setStandaloneNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );

    setSessionNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );

    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  // Handle connection start from a handle
  const handleConnectionStart = (e: React.MouseEvent, nodeId: string, handle?: string) => {
    e.stopPropagation();
    setConnectingFrom({ nodeId, handle });
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const svgX = (e.clientX - rect.left - pan.x) / zoom;
      const svgY = (e.clientY - rect.top - pan.y) / zoom;
      setConnectionPreview({ x: svgX, y: svgY });
    }
  };

  // Handle connection end on a handle
  const handleConnectionEnd = (e: React.MouseEvent, toNodeId: string, toHandle?: string) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom.nodeId !== toNodeId) {
      const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
      const toNode = nodes.find(n => n.id === toNodeId);

      if (!fromNode || !toNode) {
        setConnectingFrom(null);
        setConnectionPreview(null);
        return;
      }

      // Validation rules
      let isValid = true;
      let errorMessage = '';

      // Rule 1: Workflow prompt handle only accepts prompt nodes (not images)
      if (toNode.type === 'workflow' && toHandle === 'prompt') {
        if (fromNode.type !== 'prompt') {
          isValid = false;
          errorMessage = 'Prompt handle only accepts prompt nodes';
        }
        // Check if already has a prompt connection
        const existingPromptEdge = [...edges, ...standaloneEdges].find(
          e => e.to === toNodeId && e.toHandle === 'prompt'
        );
        if (existingPromptEdge) {
          isValid = false;
          errorMessage = 'Workflow already has a prompt connected';
        }
      }

      // Rule 2: Workflow control handle only accepts image nodes
      if (toNode.type === 'workflow' && toHandle === 'control') {
        if (!fromNode.type.includes('image')) {
          isValid = false;
          errorMessage = 'Control handle only accepts image nodes';
        }
      }

      // Rule 3: Workflow reference handle only accepts image nodes
      if (toNode.type === 'workflow' && toHandle === 'reference') {
        if (!fromNode.type.includes('image')) {
          isValid = false;
          errorMessage = 'Reference handle only accepts image nodes';
        }
      }

      if (!isValid) {
        alert(errorMessage);
        setConnectingFrom(null);
        setConnectionPreview(null);
        return;
      }

      // Determine edge color based on handle type
      let color = '#8b5cf6'; // default purple
      if (toHandle === 'control') color = '#10b981'; // green
      else if (toHandle === 'reference') color = '#3b82f6'; // blue
      else if (!toHandle) color = '#f59e0b'; // amber for output

      const newEdge: Edge = {
        from: connectingFrom.nodeId,
        to: toNodeId,
        toHandle: toHandle as 'prompt' | 'control' | 'reference' | undefined,
        color
      };
      setStandaloneEdges([...standaloneEdges, newEdge]);
    }
    setConnectingFrom(null);
    setConnectionPreview(null);
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
        onContextMenu={(e) => {
          e.stopPropagation();
          handleContextMenu(e, node.id);
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
              node.isStandalone && editingNode === node.id ? (
                <textarea
                  className={`w-full h-full p-2 text-xs resize-none rounded select-text ${
                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                  value={node.data.text}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateNodeData(node.id, { text: e.target.value });
                  }}
                  onBlur={() => setEditingNode(null)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <p
                  className="line-clamp-6 p-2 leading-relaxed cursor-text select-text"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (node.isStandalone) setEditingNode(node.id);
                  }}
                >
                  {node.data.text}
                </p>
              )
            )}
            {node.type === 'workflow' && (
              <div className="p-2 space-y-2">
                {/* Play button for workflow nodes */}
                {onGenerateFromNode && (
                  <button
                    className={`w-full flex items-center justify-center gap-2 py-2 mb-2 rounded transition-colors ${
                      isDark
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-green-500 hover:bg-green-400 text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateFromWorkflow(node.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Play size={14} fill="currentColor" />
                    Generate
                  </button>
                )}

                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Model:</span>
                  {editingNode === node.id ? (
                    <select
                      className={`text-xs px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                      value={node.data.parameters.model}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateNodeData(node.id, { parameters: { ...node.data.parameters, model: e.target.value } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <option value="gemini-2.5-flash-image">Flash</option>
                      <option value="gemini-3-pro-image-preview">Pro</option>
                    </select>
                  ) : (
                    <span className="font-medium">{node.data.parameters.model.includes('flash') ? 'Flash' : 'Pro'}</span>
                  )}
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Temperature:</span>
                  {editingNode === node.id ? (
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      className={`w-16 text-xs px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                      value={node.data.parameters.temperature}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateNodeData(node.id, { parameters: { ...node.data.parameters, temperature: parseFloat(e.target.value) } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-medium">{node.data.parameters.temperature}</span>
                  )}
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Top-p:</span>
                  {editingNode === node.id ? (
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      className={`w-16 text-xs px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                      value={node.data.parameters.top_p}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateNodeData(node.id, { parameters: { ...node.data.parameters, top_p: parseFloat(e.target.value) } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-medium">{node.data.parameters.top_p}</span>
                  )}
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Aspect Ratio:</span>
                  {editingNode === node.id ? (
                    <select
                      className={`text-xs px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                      value={node.data.parameters.aspect_ratio}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateNodeData(node.id, { parameters: { ...node.data.parameters, aspect_ratio: e.target.value } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <option value="1:1">1:1</option>
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="3:4">3:4</option>
                      <option value="4:3">4:3</option>
                    </select>
                  ) : (
                    <span className="font-medium">{node.data.parameters.aspect_ratio}</span>
                  )}
                </div>
                <div className={`flex justify-between py-1 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Image Size:</span>
                  {editingNode === node.id ? (
                    <select
                      className={`text-xs px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                      value={node.data.parameters.image_size}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateNodeData(node.id, { parameters: { ...node.data.parameters, image_size: e.target.value } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <option value="1K">1K</option>
                      <option value="2K">2K</option>
                    </select>
                  ) : (
                    <span className="font-medium">{node.data.parameters.image_size}</span>
                  )}
                </div>
                <div className={`flex justify-between py-1`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>Safety:</span>
                  {editingNode === node.id ? (
                    <select
                      className={`text-xs px-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                      value={node.data.parameters.safety_filter}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateNodeData(node.id, { parameters: { ...node.data.parameters, safety_filter: e.target.value } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  ) : (
                    <span className="font-medium">{node.data.parameters.safety_filter}</span>
                  )}
                </div>

                {/* Edit button for standalone workflow nodes */}
                {editingNode !== node.id && (
                  <button
                    className={`w-full py-1 mt-2 text-xs rounded transition-colors ${
                      isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNode(node.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    Edit Parameters
                  </button>
                )}
                {editingNode === node.id && (
                  <button
                    className={`w-full py-1 mt-2 text-xs rounded transition-colors ${
                      isDark
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-blue-500 hover:bg-blue-400 text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNode(null);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    Done
                  </button>
                )}
              </div>
            )}
            {isImage && (
              <div className="h-full flex flex-col gap-2">
                <div className="flex-1 flex flex-col">
                  {node.data.imageData ? (
                    <img
                      src={node.data.imageData}
                      alt={node.label}
                      className="w-full h-40 object-cover rounded"
                      draggable={false}
                    />
                  ) : (
                    <div className={`w-full h-40 flex items-center justify-center rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <ImageIcon className={isDark ? 'text-gray-500' : 'text-gray-400'} size={32} />
                    </div>
                  )}
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'} truncate`}>
                    {node.data.image?.filename || 'No image'}
                  </p>
                </div>
                {node.type === 'output-image' && (
                  <div className={`p-2 rounded border ${isDark ? 'border-gray-700 bg-gray-800 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                    <p className="text-[11px] leading-relaxed max-h-20 overflow-y-auto whitespace-pre-wrap">
                      {node.data.text || 'Text output will appear here'}
                    </p>
                  </div>
                )}
              </div>
            )}
            {node.type === 'output-text' && (
              <div className="h-full flex flex-col">
                <div className={`w-full h-full p-2 rounded ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-700'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                    {node.data.text || 'Text output'}
                  </p>
                </div>
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
              className="fill-purple-500 stroke-purple-300 cursor-pointer hover:r-8"
              strokeWidth={2}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id, 'prompt')}
              style={{ cursor: 'crosshair' }}
            />

            {/* Control handle */}
            <circle
              cx={0}
              cy={(node.height / 4) * 2}
              r={6}
              className="fill-green-500 stroke-green-300 cursor-pointer"
              strokeWidth={2}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id, 'control')}
              style={{ cursor: 'crosshair' }}
            />

            {/* Reference handle */}
            <circle
              cx={0}
              cy={(node.height / 4) * 3}
              r={6}
              className="fill-blue-500 stroke-blue-300 cursor-pointer"
              strokeWidth={2}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id, 'reference')}
              style={{ cursor: 'crosshair' }}
            />

            {/* Output handle */}
            <circle
              cx={node.width}
              cy={node.height / 2}
              r={6}
              className="fill-amber-500 stroke-amber-300 cursor-pointer"
              strokeWidth={2}
              onMouseDown={(e) => handleConnectionStart(e, node.id)}
              style={{ cursor: 'crosshair' }}
            />
          </>
        )}

        {/* Standard connection points for other nodes */}
        {node.type !== 'workflow' && (
          <>
            {/* Output handle (right side) */}
            <circle
              cx={node.width}
              cy={node.height / 2}
              r={4}
              className={`${isDark ? 'fill-gray-400' : 'fill-gray-500'} cursor-pointer hover:fill-blue-500`}
              onMouseDown={(e) => handleConnectionStart(e, node.id)}
              style={{ cursor: 'crosshair' }}
            />
            {/* Input handle (left side) */}
            <circle
              cx={0}
              cy={node.height / 2}
              r={4}
              className={`${isDark ? 'fill-gray-400' : 'fill-gray-500'} cursor-pointer hover:fill-blue-500`}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => handleConnectionEnd(e, node.id)}
              style={{ cursor: 'crosshair' }}
            />
          </>
        )}
      </g>
    );
  };

  const renderEdge = (edge: Edge, index: number) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);

    if (!fromNode || !toNode) return null;

    const path = generateCurvePath(fromNode, toNode, edge.toHandle);

    // Generate unique key using index to avoid duplicates
    const key = `edge-${index}-${edge.from}-${edge.to}-${edge.toHandle || 'none'}`;

    return (
      <g key={key}>
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
      className={`w-full h-full relative ${isDark ? 'bg-gray-900' : 'bg-gray-50'} select-none`}
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
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${isDraggingOver ? 'ring-4 ring-blue-500' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render edges first (behind nodes) */}
          {edges.map((edge, index) => renderEdge(edge, index))}

          {/* Render connection preview */}
          {connectingFrom && connectionPreview && (() => {
            const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
            if (!fromNode) return null;

            const fromX = fromNode.x + fromNode.width;
            const fromY = fromNode.y + fromNode.height / 2;
            const toX = connectionPreview.x;
            const toY = connectionPreview.y;
            const midX = (fromX + toX) / 2;

            const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

            return (
              <path
                d={path}
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="none"
                opacity={0.5}
                strokeDasharray="5,5"
                strokeLinecap="round"
              />
            );
          })()}

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
          <div>🔗 Drag from handles to connect</div>
          <div>🖱️ Drag canvas to pan</div>
          <div>🔍 Scroll to zoom</div>
          <div>📁 Drop images onto canvas</div>
          <div>🖱️ Right-click to add nodes</div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
          />
          <div
            className={`fixed z-50 rounded-lg shadow-xl border ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.nodeId && canDeleteNode(contextMenu.nodeId) && (
              <button
                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors rounded-t-lg ${
                  isDark ? 'text-red-300' : 'text-red-600'
                }`}
                onClick={() => deleteNode(contextMenu.nodeId!)}
              >
                <span className="text-lg">🗑️</span>
                Delete Node
              </button>
            )}
            <button
              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
              onClick={() => addPromptNode(contextMenu.svgX, contextMenu.svgY)}
            >
              <FileText size={16} />
              Add Prompt Node
            </button>
            <button
              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg transition-colors ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
              onClick={() => addWorkflowNode(contextMenu.svgX, contextMenu.svgY)}
            >
              <Settings size={16} />
              Add Workflow Node
            </button>
          </div>
        </>
      )}

      {/* Drag overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-blue-500/10">
          <div className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            Drop images here to add to canvas
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphView;
