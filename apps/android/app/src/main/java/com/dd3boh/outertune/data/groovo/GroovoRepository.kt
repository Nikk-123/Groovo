package com.dd3boh.outertune.data.groovo

import android.util.Log
import com.dd3boh.outertune.db.entities.SongEntity
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GroovoRepository @Inject constructor(
    private val httpClient: HttpClient
) {
    private val TAG = "GroovoRepository"
    private val BASE_URL = "https://login-auth-jgxb.onrender.com"

    suspend fun addToLibrary(song: SongEntity, email: String): Boolean {
        return try {
            val fullUrl = "https://www.youtube.com/watch?v=${song.id}"
            val request = LibraryAddRequest(
                url = fullUrl,
                title = song.title,
                artist = "Unknown Artist",
                thumbnail = song.thumbnailUrl ?: "",
                duration = formatDuration(song.duration),
                channel = "Unknown",
                album = song.albumName ?: ""
            )

            val response: GroovoResponse = httpClient.post("$BASE_URL/library/add") {
                contentType(ContentType.Application.Json)
                header("X-User-Email", email)
                setBody(request)
            }.body()

            if (response.success) {
                Log.i(TAG, "Successfully added to Groovo library")
            } else {
                Log.w(TAG, "Failed to add to Groovo library: ${response.message}")
            }
            response.success
        } catch (e: Exception) {
            Log.e(TAG, "Error adding to Groovo library", e)
            false
        }
    }

    suspend fun removeFromLibrary(songId: String, email: String): Boolean {
        return try {
            val fullUrl = "https://www.youtube.com/watch?v=$songId"
            val request = LibraryRemoveRequest(
                url = fullUrl
            )

            val response: GroovoResponse = httpClient.post("$BASE_URL/library/remove") {
                contentType(ContentType.Application.Json)
                header("X-User-Email", email)
                setBody(request)
            }.body()

            if (response.success) {
                Log.i(TAG, "Successfully removed from Groovo library")
            } else {
                Log.w(TAG, "Failed to remove from Groovo library: ${response.message}")
            }
            response.success
        } catch (e: Exception) {
            Log.e(TAG, "Error removing from Groovo library", e)
            false
        }
    }

    suspend fun getLibrary(email: String): List<GroovoLibraryItem>? {
        try {
            // Fetch directly from auth service to avoid cached/stale data in the main app.
            val url = "$BASE_URL/api/check-session"
            Log.d(TAG, "Attempting to fetch library from $url")
            val response: GroovoResponse = httpClient.get(url) {
                header("X-User-Email", email)
                header("Content-Type", "application/json")
                header("Cache-Control", "no-cache")
                header("Pragma", "no-cache")
            }.body()

            if (response.success && response.library != null) {
                return response.library
            }

            Log.w(TAG, "Primary library fetch failed: ${response.message}. Trying fallback endpoint...")
            val fallbackUrl = "$BASE_URL/library/get"
            try {
                Log.d(TAG, "Attempting to fetch library from $fallbackUrl")
                val fallback: GroovoResponse = httpClient.get(fallbackUrl) {
                    header("X-User-Email", email)
                    header("Content-Type", "application/json")
                    header("Cache-Control", "no-cache")
                    header("Pragma", "no-cache")
                }.body()
                if (fallback.success) {
                    return fallback.library
                } else {
                    Log.w(TAG, "Fallback library fetch failed: ${fallback.message}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error during fallback library fetch at $fallbackUrl", e)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting Groovo library", e)
        }
        return null
    }

    private fun formatDuration(durationSeconds: Int): String {
        if (durationSeconds <= 0) return ""
        val minutes = durationSeconds / 60
        val seconds = durationSeconds % 60
        return "%d:%02d".format(minutes, seconds)
    }
}
