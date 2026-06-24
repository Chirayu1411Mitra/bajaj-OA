require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

function isValidEntry(raw) {
    const s = raw.trim();
    return /^[A-Z]->[A-Z]$/.test(s);
}

function hasCycle(graph, start, allNodes) {
    const visited = new Set();
    const stack = new Set();

    function dfs(node) {
        visited.add(node);
        stack.add(node);
        for (const child of graph[node] || []) {
            if (!visited.has(child)) {
                if (dfs(child)) return true;
            } else if (stack.has(child)) {
                return true;
            }
        }
        stack.delete(node);
        return false;
    }

    for (const node of allNodes) {
        if (!visited.has(node)) {
            if (dfs(node)) return true;
        }
    }
    return false;
}

function buildNestedTree(node, graph, visited = new Set()) {
    const children = {};
    visited.add(node);
    for (const child of graph[node] || []) {
        if (!visited.has(child)) {
            children[child] = buildNestedTree(child, graph, new Set(visited));
        }
    }
    return children;
}

function calcDepth(node, graph, visited = new Set()) {
    visited.add(node);
    const children = graph[node] || [];
    if (children.length === 0) return 1;

    let max = 0;
    for (const child of children) {
        if (!visited.has(child)) {
            const d = calcDepth(child, graph, new Set(visited));
            if (d > max) max = d;
        }
    }
    return 1 + max;
}

function getComponent(node, adjUndirected, visited) {
    const component = [];
    const queue = [node];
    visited.add(node);
    while (queue.length > 0) {
        const curr = queue.shift();
        component.push(curr);
        for (const neighbor of adjUndirected[curr] || []) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return component;
}

function processData(data) {
    const invalidEntries = [];
    const duplicateEdges = [];

    const graph = {};
    const childSet = new Set();
    const allNodes = new Set();
    const seenEdges = new Set();
    const seenChildren = new Set();

    for (const raw of data) {
        const trimmed = raw.trim();

        if (!isValidEntry(trimmed)) {
            invalidEntries.push(raw);
            continue;
        }

        const parent = trimmed[0];
        const child = trimmed[3];

        const edgeKey = `${parent}->${child}`;
        if (seenEdges.has(edgeKey)) {
            if (!duplicateEdges.includes(edgeKey)) {
                duplicateEdges.push(edgeKey);
            }
            continue;
        }
        seenEdges.add(edgeKey);

        if (seenChildren.has(child)) {
            continue;
        }
        seenChildren.add(child);

        if (!graph[parent]) graph[parent] = [];
        graph[parent].push(child);

        allNodes.add(parent);
        allNodes.add(child);
        childSet.add(child);
    }

    for (const node of allNodes) {
        if (!graph[node]) graph[node] = [];
    }

    const adjUndirected = {};
    for (const node of allNodes) {
        adjUndirected[node] = new Set();
    }
    for (const [parent, children] of Object.entries(graph)) {
        for (const child of children) {
            adjUndirected[parent].add(child);
            adjUndirected[child].add(parent);
        }
    }

    const visited = new Set();
    const components = [];
    for (const node of [...allNodes].sort()) {
        if (!visited.has(node)) {
            const comp = getComponent(node, adjUndirected, visited);
            components.push(comp);
        }
    }

    const hierarchies = [];

    for (const comp of components) {
        const compSet = new Set(comp);

        const subGraph = {};
        for (const node of comp) {
            subGraph[node] = (graph[node] || []).filter((c) => compSet.has(c));
        }

        const roots = comp.filter((n) => !childSet.has(n));

        const cycleDetected = hasCycle(subGraph, comp[0], comp);

        let root;
        if (roots.length > 0) {
            root = roots.sort()[0];
        } else {
            root = comp.slice().sort()[0];
        }

        if (cycleDetected) {
            hierarchies.push({
                root,
                tree: {},
                has_cycle: true,
            });
        } else {
            const nested = { [root]: buildNestedTree(root, subGraph) };
            const depth = calcDepth(root, subGraph);
            hierarchies.push({
                root,
                tree: nested,
                depth,
            });
        }
    }

    const nonCyclic = hierarchies.filter((h) => !h.has_cycle);
    const cyclic = hierarchies.filter((h) => h.has_cycle);

    let largestTreeRoot = "";
    if (nonCyclic.length > 0) {
        const sorted = [...nonCyclic].sort((a, b) => {
            if (b.depth !== a.depth) return b.depth - a.depth;
            return a.root.localeCompare(b.root);
        });
        largestTreeRoot = sorted[0].root;
    }

    const summary = {
        total_trees: nonCyclic.length,
        total_cycles: cyclic.length,
        largest_tree_root: largestTreeRoot,
    };

    return { hierarchies, invalidEntries, duplicateEdges, summary };
}

app.post("/bfhl", (req, res) => {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Request body must have a 'data' array." });
    }

    const { hierarchies, invalidEntries, duplicateEdges, summary } = processData(data);

    return res.json({
        user_id: process.env.USER_ID,
        email_id: process.env.EMAIL,
        college_roll_number: process.env.ROLL_NUMBER,
        hierarchies,
        invalid_entries: invalidEntries,
        duplicate_edges: duplicateEdges,
        summary,
    });
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}