package com.femina.util;

import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 仅读取图片文件头解析宽高（JPEG/PNG/GIF/BMP/WEBP），不解码像素、不写文件。
 * JPEG 走流式 marker 遍历，不受 EXIF/XMP 段大小限制（相机原图的 SOF 可能在
 * 上百 KB 偏移处）。解析失败返回 null（调用方按未知处理）。
 */
public final class ImageDims {

    private ImageDims() {
    }

    public static int[] read(Path file) {
        try (InputStream raw = Files.newInputStream(file)) {
            DataInputStream in = new DataInputStream(raw);
            int b0 = in.read();
            int b1 = in.read();
            if (b0 < 0 || b1 < 0) {
                return null;
            }
            if (b0 == 0xFF && b1 == 0xD8) {
                return jpegStream(in);
            }
            byte[] head = new byte[32];
            head[0] = (byte) b0;
            head[1] = (byte) b1;
            int read = 2;
            while (read < head.length) {
                int n = in.read(head, read, head.length - read);
                if (n < 0) {
                    break;
                }
                read += n;
            }
            if (read < 24) {
                return null;
            }
            if ((head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
                return new int[] { be32(head, 16), be32(head, 20) };
            }
            if (head[0] == 'G' && head[1] == 'I' && head[2] == 'F') {
                return new int[] { le16(head, 6), le16(head, 8) };
            }
            if (head[0] == 'B' && head[1] == 'M') {
                return new int[] { le32(head, 18), Math.abs(le32(head, 22)) };
            }
            if (head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
                return webp(head);
            }
            return null;
        } catch (IOException e) {
            return null;
        }
    }

    /** 遍历 JPEG marker 直到 SOFn；跳过 APP/注释/DHT 等任意长度的段 */
    private static int[] jpegStream(DataInputStream in) throws IOException {
        while (true) {
            int marker = 0;
            while (marker != 0xFF) {
                marker = in.readUnsignedByte();
            }
            while (marker == 0xFF) {
                marker = in.readUnsignedByte(); // 填充字节
            }
            if (marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
                continue; // 无段长度
            }
            if (marker == 0xDA || marker == 0xD9) {
                return null; // 到熵编码/结尾仍未见 SOF
            }
            int segLen = in.readUnsignedShort();
            boolean sof = marker >= 0xC0 && marker <= 0xCF
                    && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
            if (sof) {
                in.readUnsignedByte(); // precision
                int h = in.readUnsignedShort();
                int w = in.readUnsignedShort();
                return new int[] { w, h };
            }
            long rem = segLen - 2L;
            while (rem > 0) {
                long s = in.skip(rem);
                if (s <= 0) {
                    return null;
                }
                rem -= s;
            }
        }
    }

    private static int[] webp(byte[] b) {
        String chunk = new String(b, 12, 4, StandardCharsets.US_ASCII);
        if ("VP8X".equals(chunk)) {
            int w = 1 + (b[24] & 0xFF) | (b[25] & 0xFF) << 8 | (b[26] & 0xFF) << 16;
            int h = 1 + (b[27] & 0xFF) | (b[28] & 0xFF) << 8 | (b[29] & 0xFF) << 16;
            return new int[] { w, h };
        }
        if ("VP8L".equals(chunk)) {
            int bits = le32(b, 21);
            return new int[] { (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1 };
        }
        if ("VP8 ".equals(chunk)) {
            return new int[] { le16(b, 26) & 0x3FFF, le16(b, 28) & 0x3FFF };
        }
        return null;
    }

    private static int be32(byte[] a, int o) {
        return ByteBuffer.wrap(a, o, 4).order(ByteOrder.BIG_ENDIAN).getInt();
    }

    private static int le32(byte[] a, int o) {
        return ByteBuffer.wrap(a, o, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
    }

    private static int le16(byte[] a, int o) {
        return ByteBuffer.wrap(a, o, 2).order(ByteOrder.LITTLE_ENDIAN).getShort() & 0xFFFF;
    }
}
