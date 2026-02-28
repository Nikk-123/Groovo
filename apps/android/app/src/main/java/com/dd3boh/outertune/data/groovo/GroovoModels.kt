package com.dd3boh.outertune.data.groovo

import kotlinx.serialization.Serializable

@Serializable
data class LibraryAddRequest(
    val url: String,
    val title: String,
    val artist: String,
    val thumbnail: String,
    val duration: String,
    val channel: String,
    val album: String
)

@Serializable
data class LibraryRemoveRequest(
    val url: String
)

@Serializable
data class GroovoLibraryItem(
    val url: String,
    val title: String,
    val artist: String,
    val thumbnail: String,
    val duration: String,
    val channel: String? = null,
    val album: String? = null,
    val dateAdded: String? = null
)

@Serializable
data class GroovoResponse(
    val success: Boolean,
    val message: String? = null,
    val library: List<GroovoLibraryItem>? = null
)
