package com.dd3boh.outertune.data.mapper

import com.dd3boh.outertune.db.entities.ArtistEntity
import com.dd3boh.outertune.db.entities.SongArtistMap
import com.dd3boh.outertune.db.entities.SongEntity
import com.dd3boh.outertune.models.SongDto
import java.time.LocalDateTime
import javax.inject.Inject

class LibraryMapper @Inject constructor() {
    fun mapSongs(remoteSongs: List<SongDto>): Triple<List<SongEntity>, List<ArtistEntity>, List<SongArtistMap>> {
        val songEntities = mutableListOf<SongEntity>()
        val artistEntities = mutableListOf<ArtistEntity>()
        val songArtistMaps = mutableListOf<SongArtistMap>()

        remoteSongs.forEach { dto ->
            // Extract video ID from URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)
            val songId = if (dto.url.contains("v=")) {
                dto.url.substringAfter("v=").substringBefore("&")
            } else if (dto.url.contains("youtu.be/")) {
                dto.url.substringAfter("youtu.be/").substringBefore("?")
            } else {
                 dto.url // Fallback, though likely to fail if not an ID
            }
            val artistName = dto.artist ?: "Unknown Artist"
            val artistId = "LA" + artistName.hashCode().toString().replace("-", "") // Simple deterministic ID

            // Song Entity
            val song = SongEntity(
                id = songId,
                title = dto.title,
                thumbnailUrl = dto.thumbnail,
                inLibrary = LocalDateTime.now(),
                localPath = null,
                liked = true,
                likedDate = LocalDateTime.now(),
                duration = parseDuration(dto.duration)
            )
            songEntities.add(song)

            // Artist Entity
            val artist = ArtistEntity(
                id = artistId,
                name = artistName,
                lastUpdateTime = LocalDateTime.now()
            )
            artistEntities.add(artist)

            // Relation
            songArtistMaps.add(SongArtistMap(songId = songId, artistId = artistId, position = 0))
        }

        return Triple(songEntities, artistEntities, songArtistMaps)
    }

    private fun parseDuration(durationStr: String?): Int {
        // Assuming format "MM:SS" or just seconds
        if (durationStr.isNullOrEmpty()) return -1
        try {
            val parts = durationStr.split(":")
            if (parts.size == 2) {
                return parts[0].toInt() * 60 + parts[1].toInt()
            }
            return durationStr.toInt()
        } catch (e: Exception) {
            return -1
        }
    }
}
