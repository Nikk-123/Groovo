package com.kyant.taglib

import android.media.MediaMetadataRetriever
import android.os.ParcelFileDescriptor

object TagLib {
    data class AudioProperties(
        val length: Int,
        val channels: Int,
        val sampleRate: Int,
        val bitrate: Int,
        val codec: String
    )

    data class Metadata(
        val propertyMap: Map<String, List<String>>
    )

    @JvmStatic
    fun getAudioProperties(fd: Int): AudioProperties? {
        val retriever = MediaMetadataRetriever()
        val pfd = ParcelFileDescriptor.adoptFd(fd)
        return try {
            retriever.setDataSource(pfd.fileDescriptor)

            val length = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toIntOrNull() ?: 0
            val bitrateBps = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toIntOrNull() ?: 0
            val bitrate = if (bitrateBps > 0) bitrateBps / 1000 else 0
            val sampleRate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_SAMPLERATE)?.toIntOrNull() ?: 0
            val codec = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE).orEmpty()

            AudioProperties(
                length = length,
                channels = 0,
                sampleRate = sampleRate,
                bitrate = bitrate,
                codec = codec
            )
        } catch (_: Exception) {
            null
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
            try {
                pfd.close()
            } catch (_: Exception) {
            }
        }
    }

    @JvmStatic
    fun getMetadata(fd: Int, readPictures: Boolean): Metadata? {
        val retriever = MediaMetadataRetriever()
        val pfd = ParcelFileDescriptor.adoptFd(fd)
        return try {
            retriever.setDataSource(pfd.fileDescriptor)

            val map = linkedMapOf<String, MutableList<String>>()
            fun put(key: String, value: String?) {
                val v = value?.trim()
                if (!v.isNullOrEmpty()) {
                    map.getOrPut(key) { mutableListOf() }.add(v)
                }
            }

            put("TITLE", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE))
            put("ALBUM", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM))
            put("ARTIST", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST))
            put("GENRE", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE))
            put("DATE", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE))
            put("TRACKNUMBER", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER))
            put("DISCNUMBER", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER))

            Metadata(map)
        } catch (_: Exception) {
            null
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
            try {
                pfd.close()
            } catch (_: Exception) {
            }
        }
    }
}
