import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const PropertyMapDialog = ({ property, open, onOpenChange }) => {
  const [status, setStatus] = useState("idle");
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setStatus("loading");

    api
      .get(`/api/properties/${property._id}/location`, {
        signal: controller.signal,
      })
      .then((response) => {
        setCoords({ lat: response.data.lat, lng: response.data.lng });
        setStatus("success");
      })
      .catch(() => {
        setStatus("error");
      });

    return () => controller.abort();
  }, [open, property._id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>מיקום הנכס</DialogTitle>
          <DialogDescription>
            {property.street}, {property.city}
          </DialogDescription>
        </DialogHeader>

        {status === "loading" && (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            טוען מפה…
          </div>
        )}

        {status === "error" && (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            לא ניתן היה לאתר את מיקום הנכס במפה
          </div>
        )}

        {status === "success" && coords && (
          <div className="h-72 w-full overflow-hidden rounded-xl">
            <MapContainer
              center={[coords.lat, coords.lng]}
              zoom={10}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[coords.lat, coords.lng]}>
                <Popup>
                  {property.street}, {property.city}
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PropertyMapDialog;
