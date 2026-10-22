# 3inview

A Node.js application that bridges 3DS system input data to a web overlay via SSE (Server-Sent Events).

## Project Overview
The system connects to a 3DS console as a TCP client (on port 65534) to receive raw input data. This data is decoded into human-readable button states and served to a web frontend in real-time, allowing for an interactive overlay experience.

## Current Status

### Completed
- **Protocol Decoder**: Implemented a robust decoder that handles little-endian parsing, version checks (v4), and magic byte identification (`0x49`, `0x33`).
- **Type System & Button Mapping**: Defined a comprehensive `Frame` interface and a mapping system to translate raw bitfields into readable gamepad button states (e.g., "A", "B", "X", "Y", "D-Pad", etc.).
- **TCP Client (`TcpReader`)**: Built a persistent TCP client featuring:
    - **Buffer Management**: Handles TCP fragmentation by accumulating data in a continuous buffer.
    - **Resync Logic**: Automatically scans the buffer for the correct magic bytes to recover the stream if synchronization is lost.
    - **Frame Processing**: Extracts and decodes 32-byte frames as they become available.

### Next Steps
- **Hono Server**: Implement a Hono-based web server to handle the SSE stream.
- **Overlay**: Develop a frontend overlay that subscribes to the SSE stream and displays the real-time gamepad inputs.
- **Refinement**: Optimize buffer handling and add error reporting/logging.
