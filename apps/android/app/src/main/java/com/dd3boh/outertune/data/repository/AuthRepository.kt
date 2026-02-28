package com.dd3boh.outertune.data.repository

import com.dd3boh.outertune.data.mapper.LibraryMapper
import com.dd3boh.outertune.data.remote.AuthService
import com.dd3boh.outertune.db.MusicDatabase
import com.dd3boh.outertune.models.AuthResponse
import com.dd3boh.outertune.models.LoginRequest
import com.dd3boh.outertune.models.SignupRequest
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authService: AuthService,
    private val libraryMapper: LibraryMapper,
    private val database: MusicDatabase
) {
    suspend fun login(email: String, password: String? = null, autoLogin: Boolean = false) = flow {
        emit(Result.loading())
        try {
            val response = authService.login(LoginRequest(email, password, autoLogin))
            if (response.success) {
                // Sync library if present
                response.library?.let { songs ->
                    val (songEntities, artistEntities, songArtistMaps) = libraryMapper.mapSongs(songs)
                    // Insert into DB
                    database.query {
                        artistEntities.forEach { insert(it) } // Insert artists first
                        songEntities.forEach { insert(it) }
                        songArtistMaps.forEach { insert(it) }
                    }
                }
                emit(Result.success(response))
            } else {
                emit(Result.error(response.message))
            }
        } catch (e: Exception) {
            emit(Result.error(e.message ?: "Unknown error"))
        }
    }

    suspend fun signup(email: String, password: String) = flow {
        emit(Result.loading())
        try {
            val response = authService.signup(SignupRequest(email, password))
            if (response.success) {
                emit(Result.success(response))
            } else {
                emit(Result.error(response.message))
            }
        } catch (e: Exception) {
            emit(Result.error(e.message ?: "Unknown error"))
        }
    }
}

sealed class Result<T> {
    class Loading<T> : Result<T>()
    data class Success<T>(val data: T) : Result<T>()
    data class Error<T>(val message: String) : Result<T>()

    companion object {
        fun <T> loading() = Loading<T>()
        fun <T> success(data: T) = Success(data)
        fun <T> error(message: String) = Error<T>(message)
    }
}
