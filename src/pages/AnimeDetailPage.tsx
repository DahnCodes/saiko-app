import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiHeart } from "react-icons/fi";
import { toast } from 'react-toastify';
import { useAuth } from "../context/AuthContext.tsx";
import { getAnimeById } from "../services/animeService.ts";
import {
  getAnimeCharacters,
  type AniListCharacterEdge,
} from "../services/aniListService.ts";
import {
  getFavoriteCharacterIds,
  isAnimeFavorite,
  setAnimeFavorite,
  setCharacterFavorite,
} from "../services/tasteProfile.ts";
import type { Anime } from "../types/anime.ts";
import "../anime.css";

export default function AnimeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [favorite, setFavorite] = useState(false);
  const [characters, setCharacters] = useState<AniListCharacterEdge[]>([]);
  const [charactersStatus, setCharactersStatus] = useState<
    "loading" | "success" | "error"
  >("loading");
  const [characterFavorites, setCharacterFavorites] = useState<Set<number>>(
    new Set(),
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (id)
      void getAnimeById(id)
        .then((item) => {
          setAnime(item);
          setStatus("success");
        })
        .catch(() => setStatus("error"));
  }, [id]);
  useEffect(() => {
    if (!anime) return;
    void getAnimeCharacters(anime.anilistId, 12)
      .then((items) => {
        setCharacters(items);
        setCharactersStatus("success");
      })
      .catch(() => setCharactersStatus("error"));
    if (user) {
      void isAnimeFavorite(user.id, anime.id)
        .then(setFavorite)
        .catch(() => undefined);
      void getFavoriteCharacterIds(user.id)
        .then(setCharacterFavorites)
        .catch(() => undefined);
    }
  }, [anime, user]);
  async function toggleAnimeFavorite() {
    if (!user || !anime) return;
    const next = !favorite;
    setFavorite(next);
    try {
      await setAnimeFavorite(user.id, anime.id, next);
      toast.success(next ? `${anime.title} added to your favorites.` : `${anime.title} removed from your favorites.`);
    } catch {
      setFavorite(!next);
      setMessage("We could not save that favorite. Please try again.");
      toast.error("We could not save that favorite. Please try again.");
    }
  }
  async function toggleCharacterFavorite(characterId: number) {
    if (!user || !anime) return;
    const next = !characterFavorites.has(characterId);
    setCharacterFavorites((current) => {
      const copy = new Set(current);
      if (next) copy.add(characterId);
      else copy.delete(characterId);
      return copy;
    });
    try {
      await setCharacterFavorite(user.id, characterId, anime.id, next);
      toast.success(next ? "Character added to your favorites." : "Character removed from your favorites.");
    } catch {
      setCharacterFavorites((current) => {
        const copy = new Set(current);
        if (next) copy.delete(characterId);
        else copy.add(characterId);
        return copy;
      });
      setMessage(
        "We could not save that character favorite. Please try again.",
      );
      toast.error("We could not save that character favorite. Please try again.");
    }
  }
  if (status === "loading")
    return (
      <section className="detail-state">
        <p className="eyebrow">Loading title</p>
        <h1>Finding the story...</h1>
      </section>
    );
  if (status === "error" || !anime)
    return (
      <section className="detail-state">
        <p className="eyebrow">Something went wrong</p>
        <h1>Anime unavailable</h1>
        <p>We could not load this title right now.</p>
        <Link className="back-link" to="/anime">
          ← Back to anime
        </Link>
      </section>
    );
  return (
    <article className="anime-detail">
      <Link className="back-link" to="/anime">
        ← Back to anime
      </Link>
      <div className="detail-layout">
        {anime.imageUrl && (
          <img
            className="detail-poster"
            src={anime.imageUrl}
            alt={`${anime.title} cover`}
          />
        )}
        <div className="detail-copy">
          <p className="eyebrow">
            {anime.type ?? "Anime"} {anime.year ? `· ${anime.year}` : ""}
          </p>
          <h1>{anime.title}</h1>
          <p className="detail-meta">
            {anime.score
              ? `★ ${anime.score.toFixed(1)} rating`
              : "No rating yet"}{" "}
            {anime.episodes ? ` · ${anime.episodes} episodes` : ""}
          </p>
          <p className="detail-synopsis">
            {anime.synopsis ?? "Synopsis coming soon."}
          </p>
          <button
            className="primary-action"
            onClick={() => void toggleAnimeFavorite()}
            disabled={!user}
          >
            {favorite ? "Added" : "Add to Favorites"}
          </button>
        </div>
      </div>
      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}
      <section className="detail-characters">
        <p className="eyebrow">FEATURED CHARACTERS</p>
        {charactersStatus === "loading" && <p>Loading the cast...</p>}
        {charactersStatus === "error" && (
          <p>We couldn't load the cast right now. Try again later.</p>
        )}
        {charactersStatus === "success" && (
          <div className="anime-grid">
            {characters.slice(0, 10).map((edge) => (
                <div className="anime-card character-card" key={edge.node.id}>
                  <div className="character-card-image">
                    {edge.node.image?.large && (
                      <img
                        src={edge.node.image.large}
                        alt={edge.node.name.full ?? "Character"}
                        loading="lazy"
                      />
                    )}
                    <button
                      className={`character-favorite ${characterFavorites.has(edge.node.id) ? "is-favorite" : ""}`}
                      onClick={() => void toggleCharacterFavorite(edge.node.id)}
                      disabled={!user}
                      aria-label={characterFavorites.has(edge.node.id) ? "Remove character favorite" : "Favorite character"}
                      aria-pressed={characterFavorites.has(edge.node.id)}
                    >
                      <FiHeart aria-hidden="true" />
                    </button>
                  </div>
                  <div className="anime-card-body">
                    <h3>{edge.node.name.full ?? "Character"}</h3>
                    <p className="anime-meta">{edge.role ?? "SUPPORTING"}</p>
                  </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
