'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  type SvgIconProps,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { logger } from '@middle-earth/libs/publishable/web/logger';
import { type JSX, useCallback, useEffect, useState } from 'react';
import {
  FacebookIcon,
  FacebookShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  WhatsappIcon,
  WhatsappShareButton,
  XIcon,
  TwitterShareButton as XShareButton,
} from 'react-share';
import { SocialIcon } from 'react-social-icons';
import { useCopyToClipboard, useToggle } from 'react-use';

import { Button, CloseIcon, ShareIcon } from '../../atoms';

const SOCIAL_SHARE_BUTTONS = [
  { Icon: LinkedinIcon, name: 'LinkedIn', SocialShare: LinkedinShareButton },
  { Icon: XIcon, name: 'X', SocialShare: XShareButton },
  { Icon: FacebookIcon, name: 'Facebook', SocialShare: FacebookShareButton },
  { Icon: WhatsappIcon, name: 'WhatsApp', SocialShare: WhatsappShareButton },
] as const;

type ShareProps = {
  color?: string;
  CustomIcon?: (props: SvgIconProps) => JSX.Element;
  imageUrl?: string;
} & Omit<ShareData, 'files'>;

export const Share = ({
  color = 'primary.1000',
  CustomIcon,
  imageUrl,
  text,
  title,
  url,
}: ShareProps): JSX.Element => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [open, toggleOpen] = useToggle(false);
  const [{ value: clipboardValue }, copyToClipboard] = useCopyToClipboard();

  useEffect(() => {
    setShareUrl(url ?? globalThis.location.href);
  }, [url]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia(
      '(hover: hover) and (pointer: fine)',
    );
    const isDesktopDevice =
      mediaQuery.matches &&
      !/Android|webOS|iPhone|iPad/i.test(navigator.userAgent);

    setIsDesktop(isDesktopDevice);
  }, []);

  const convertImageUrlToFile = useCallback(async () => {
    if (!imageUrl || isDesktop) {
      setImageFile(null);

      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const extension = blob.type.split('/')[1] || 'jpg';
      const filename = `${imageUrl.split('/').pop()?.split('?')[0] || 'image'}.${extension}`;

      const file = new File([blob], filename, { type: blob.type });

      setImageFile(file);
    } catch (error) {
      logger.debug({ error }, 'Error converting image URL to File');
      setImageFile(null);
    }
  }, [imageUrl, isDesktop]);

  useEffect(() => {
    void convertImageUrlToFile();
  }, [convertImageUrlToFile]);

  const handleNativeShare = useCallback(async () => {
    const baseShareData: ShareData = {
      ...(text && { text }),
      ...(title && { title }),
      url: shareUrl,
    };

    try {
      await (imageFile && navigator.canShare({ files: [imageFile] })
        ? navigator.share({ ...baseShareData, files: [imageFile] })
        : navigator.share(baseShareData));
    } catch (error) {
      logger.debug({ error }, 'Share failed');

      try {
        await navigator.share(baseShareData);
      } catch (fallbackError) {
        logger.debug({ error: fallbackError }, 'Fallback share failed');
      }
    }
  }, [imageFile, shareUrl, text, title]);

  const handleClick = useCallback(() => {
    if (isDesktop) {
      toggleOpen();
    } else {
      void handleNativeShare();
    }
  }, [isDesktop, handleNativeShare, toggleOpen]);

  return (
    <>
      <Tooltip placement="top" title="Share">
        <IconButton aria-label="share" onClick={handleClick}>
          {CustomIcon ? (
            <CustomIcon sx={{ color }} />
          ) : (
            <ShareIcon sx={{ color }} />
          )}
        </IconButton>
      </Tooltip>

      <Dialog
        disableScrollLock
        maxWidth="lg"
        onClose={toggleOpen}
        open={open}
        slotProps={{
          paper: { sx: { borderRadius: 3, boxShadow: 2, p: 2 } },
        }}
      >
        <DialogTitle component="div" sx={{ pb: 4, pt: 0 }}>
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
          >
            <Typography variant="h6">Share</Typography>
            <IconButton onClick={toggleOpen}>
              <CloseIcon color="primary" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack direction="column" gap={5}>
            <Stack direction="row" gap={3} width={1}>
              {SOCIAL_SHARE_BUTTONS.map(({ Icon, name, SocialShare }) => (
                <SocialShare key={name} url={shareUrl}>
                  <Stack gap={1}>
                    <Icon round />
                    <Typography variant="body2">{name}</Typography>
                  </Stack>
                </SocialShare>
              ))}

              <Stack gap={1}>
                <SocialIcon
                  network="instagram"
                  rel="noopener noreferrer"
                  style={{ height: 64, width: 64 }}
                  target="_blank"
                  url="https://www.instagram.com"
                />

                <Typography variant="body2">Instagram</Typography>
              </Stack>
            </Stack>

            <TextField
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        color="brand.dark"
                        onClick={() => copyToClipboard(shareUrl)}
                        variant="contained"
                      >
                        {clipboardValue === shareUrl ? 'Copied' : 'Copy'}
                      </Button>
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 3 },
                },
              }}
              value={shareUrl}
              variant="outlined"
            />
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
};
